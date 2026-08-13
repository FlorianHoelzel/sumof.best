import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { SiteData } from "./pb-history";
import { buildUserArchive } from "./speedrun-archive";
import { demoRunnerData } from "./data/demo-runner";

const CACHE_SCHEMA_VERSION = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_MS = numberFromEnv("ARCHIVE_CACHE_FRESH_DAYS", 1) * DAY_MS;
const RETENTION_MS = numberFromEnv("ARCHIVE_CACHE_RETENTION_DAYS", 180) * DAY_MS;
const EMPTY_FRESH_MS = numberFromEnv("ARCHIVE_CACHE_EMPTY_FRESH_HOURS", 24) * 60 * 60 * 1000;
const NOT_FOUND_MS = numberFromEnv("ARCHIVE_CACHE_NOT_FOUND_MINUTES", 30) * 60 * 1000;
const LOCK_STALE_MS = numberFromEnv("ARCHIVE_CACHE_LOCK_MINUTES", 15) * 60 * 1000;
const LOCK_WAIT_MS = numberFromEnv("ARCHIVE_CACHE_LOCK_WAIT_MINUTES", 5) * 60 * 1000;

type CacheEnvelope = {
  version: number;
  key: string;
  storedAt: string;
  refreshAfter: string;
  expiresAt: string;
  data: SiteData | null;
};

const builds = new Map<string, Promise<SiteData | null>>();
const memoryCache = new Map<string, CacheEnvelope>();

async function ensureDirectory(directory: string) {
  try {
    await access(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(directory, { recursive: true });
  }
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cacheDirectory() {
  return process.env.ARCHIVE_CACHE_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/archive-cache"
      : path.join(process.cwd(), ".cache", "archive-cache"));
}

function normalizedUsername(username: string) {
  return username.trim().replace(/^@/, "").normalize("NFKC").toLowerCase();
}

function cacheKey(username: string) {
  return createHash("sha256").update(normalizedUsername(username)).digest("hex");
}

function pathsFor(key: string) {
  const directory = cacheDirectory();
  return {
    directory,
    archive: path.join(directory, `${key}.json`),
    lock: path.join(directory, `${key}.lock`),
  };
}

function cacheEnvelope(key: string, data: SiteData | null): CacheEnvelope {
  const now = Date.now();
  const freshFor = data === null
    ? NOT_FOUND_MS
    : data.histories.length
      ? FRESH_MS
      : EMPTY_FRESH_MS;
  const expiresIn = data === null ? NOT_FOUND_MS : RETENTION_MS;

  return {
    version: CACHE_SCHEMA_VERSION,
    key,
    storedAt: new Date(now).toISOString(),
    refreshAfter: new Date(now + freshFor).toISOString(),
    expiresAt: new Date(now + expiresIn).toISOString(),
    data,
  };
}

function lacksWritableFileSystem(error: unknown) {
  return ["EPERM", "EROFS", "ENOSYS"].includes(
    (error as NodeJS.ErrnoException).code ?? "",
  );
}

async function readEnvelope(file: string): Promise<CacheEnvelope | null> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as CacheEnvelope;
    if (
      parsed.version !== CACHE_SCHEMA_VERSION ||
      typeof parsed.key !== "string" ||
      typeof parsed.storedAt !== "string" ||
      typeof parsed.refreshAfter !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      !(parsed.data === null || parsed.data?.profile?.name)
    ) {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Unable to read an archive cache entry", error);
    }
    return null;
  }
}

async function writeEnvelope(file: string, envelope: CacheEnvelope) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(envelope), "utf8");
  await rename(temporary, file);
}

async function removeStaleLock(file: string) {
  try {
    const lock = await stat(file);
    if (Date.now() - lock.mtimeMs > LOCK_STALE_MS) await unlink(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function acquireLock(lockFile: string, archiveFile: string, startedAt: number) {
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      await writeFile(lockFile, `${process.pid}:${new Date().toISOString()}`, {
        flag: "wx",
      });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const cached = await readEnvelope(archiveFile);
    if (cached && Date.parse(cached.storedAt) >= startedAt) return false;

    await removeStaleLock(lockFile);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error("Timed out waiting for another archive build to finish");
}

async function buildAndStore(username: string, key: string) {
  const files = pathsFor(key);
  try {
    await ensureDirectory(files.directory);
  } catch (error) {
    if (!lacksWritableFileSystem(error)) throw error;
    const data = await buildUserArchive(username);
    memoryCache.set(key, cacheEnvelope(key, data));
    return data;
  }
  const startedAt = Date.now();
  const ownsLock = await acquireLock(files.lock, files.archive, startedAt);

  if (!ownsLock) return (await readEnvelope(files.archive))?.data ?? null;

  try {
    const data = await buildUserArchive(username);
    const envelope = cacheEnvelope(key, data);
    await writeEnvelope(files.archive, envelope);
    return data;
  } finally {
    await unlink(files.lock).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.error("Unable to release archive cache lock", error);
    });
  }
}

function startBuild(username: string, key: string) {
  const existing = builds.get(key);
  if (existing) return existing;

  const build = buildAndStore(username, key).finally(() => builds.delete(key));
  builds.set(key, build);
  return build;
}

export async function getUserArchive(username: string): Promise<SiteData | null> {
  const cleanUsername = username.trim().replace(/^@/, "");
  if (!cleanUsername) return null;
  if (cleanUsername.toLowerCase() === demoRunnerData.profile.name) {
    return demoRunnerData;
  }

  const key = cacheKey(cleanUsername);
  const cached = memoryCache.get(key) ?? await readEnvelope(pathsFor(key).archive);
  const now = Date.now();

  if (cached && now < Date.parse(cached.refreshAfter)) return cached.data;

  if (cached && cached.data !== null && now < Date.parse(cached.expiresAt)) {
    void startBuild(cleanUsername, key).catch((error) => {
      console.error(`Unable to refresh archive for ${cleanUsername}`, error);
    });
    return cached.data;
  }

  return startBuild(cleanUsername, key);
}

export function warmUserArchive(username: string) {
  void getUserArchive(username).catch((error) => {
    console.error(`Unable to warm archive for ${username}`, error);
  });
}

export type DiscoverableArchive = {
  name: string;
  lastModified: string;
};

export async function listDiscoverableArchives(): Promise<DiscoverableArchive[]> {
  const directory = cacheDirectory();
  let files: string[];

  try {
    files = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Unable to list archive cache entries", error);
    }
    return [];
  }

  const now = Date.now();
  const archives = new Map<string, DiscoverableArchive>();

  for (const file of files) {
    if (!file.endsWith(".json") || archives.size >= 49_000) continue;

    const envelope = await readEnvelope(path.join(directory, file));
    if (
      !envelope?.data?.histories.length ||
      now >= Date.parse(envelope.expiresAt) ||
      envelope.data.source === "demo"
    ) {
      continue;
    }

    const name = envelope.data.profile.name;
    archives.set(name.toLocaleLowerCase("en-US"), {
      name,
      lastModified: envelope.data.generatedAt || envelope.storedAt,
    });
  }

  return [...archives.values()].sort((a, b) =>
    b.lastModified.localeCompare(a.lastModified),
  );
}
