import { NextResponse } from "next/server";
import { requestSpeedrunJson, SpeedrunApiError } from "../../speedrun-api";
import { demoRunnerData } from "../../data/demo-runner";

const LOOKUP_FRESH_MS = 5 * 60 * 1_000;
const LOOKUP_STALE_MS = 24 * 60 * 60 * 1_000;
const NOT_FOUND_FRESH_MS = 30 * 1_000;
const lookupCache = new Map<
  string,
  { storedAt: number; user: SpeedrunUser | null }
>();

type SpeedrunUser = {
  id: string;
  names?: { international?: string };
  weblink?: string;
  assets?: {
    image?: { uri?: string };
    icon?: { uri?: string };
  };
  "name-style"?: {
    style?: string;
    color?: { dark?: string };
    "color-from"?: { dark?: string };
    "color-to"?: { dark?: string };
  };
  location?: {
    country?: {
      names?: { international?: string };
    };
  };
};

async function lookupUser(username: string, signal: AbortSignal) {
  const key = username.normalize("NFKC").toLowerCase();
  const cached = lookupCache.get(key);
  const freshFor = cached?.user ? LOOKUP_FRESH_MS : NOT_FOUND_FRESH_MS;

  if (cached && Date.now() - cached.storedAt < freshFor) {
    return { stale: false, user: cached.user };
  }

  try {
    const payload = await requestSpeedrunJson<{ data?: SpeedrunUser[] }>(
      `/users?lookup=${encodeURIComponent(username)}`,
      {
        signal,
        userAgent: "SumOfBest/0.1 (username lookup; https://sumof.best)",
      },
    );
    const user = payload?.data?.[0] ?? null;
    lookupCache.set(key, { storedAt: Date.now(), user });
    return { stale: false, user };
  } catch (error) {
    if (
      cached?.user &&
      Date.now() - cached.storedAt < LOOKUP_STALE_MS
    ) {
      console.warn(`Using a stale speedrun.com lookup for ${username}`);
      return { stale: true, user: cached.user };
    }
    throw error;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim().replace(/^@/, "");

  if (!username || username.length > 64) {
    return NextResponse.json(
      { error: "Enter a valid speedrun.com username." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (username.toLowerCase() === demoRunnerData.profile.name) {
    return NextResponse.json({
      id: "demo",
      name: demoRunnerData.profile.name,
      country: demoRunnerData.profile.country,
      avatar: demoRunnerData.profile.avatar,
      profileUrl: demoRunnerData.profile.profileUrl,
      archiveUrl: `/${demoRunnerData.profile.name}`,
    });
  }

  try {
    const lookup = await lookupUser(username, request.signal);
    const user = lookup.user;

    if (!user) {
      return NextResponse.json(
        { error: `No speedrun.com user named “${username}” was found.` },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const name = user.names?.international ?? username;
    const country = user.location?.country?.names?.international ?? null;
    const sourceAvatar =
      user.assets?.image?.uri ?? user.assets?.icon?.uri ?? null;
    const rawNameStyle = user["name-style"];
    const nameColor = rawNameStyle
      ? {
          from:
            rawNameStyle["color-from"]?.dark ??
            rawNameStyle.color?.dark ??
            null,
          to:
            rawNameStyle["color-to"]?.dark ??
            rawNameStyle.color?.dark ??
            null,
        }
      : null;

    return NextResponse.json(
      {
        id: user.id,
        name,
        country,
        avatar: sourceAvatar,
        nameColor,
        profileUrl: user.weblink ?? `https://www.speedrun.com/users/${name}`,
        archiveUrl: `/${encodeURIComponent(name)}`,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
          "X-Speedrun-Data": lookup.stale ? "stale" : "live",
        },
      },
    );
  } catch (error) {
    if (error instanceof SpeedrunApiError) {
      console.error("Unable to look up speedrun.com user", {
        username,
        status: error.status,
        rayId: error.rayId,
      });
    } else {
      console.error(`Unable to look up speedrun.com user ${username}`, error);
    }
    return NextResponse.json(
      { error: "Speedrun.com is temporarily unavailable. Try again shortly." },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          ...(error instanceof SpeedrunApiError && error.status
            ? { "X-Speedrun-Status": String(error.status) }
            : {}),
        },
      },
    );
  }
}
