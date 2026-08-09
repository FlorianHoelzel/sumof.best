"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ArchiveLoadingView from "../archive-loading-view";

type LookupResult = {
  id: string;
  name: string;
  country: string | null;
  avatar: string | null;
  profileUrl: string;
  archiveUrl: string | null;
};

type RememberedRunner = Pick<
  LookupResult,
  "name" | "country" | "avatar" | "archiveUrl"
>;

type LookupPhase = "idle" | "typing" | "loading" | "success" | "error";

const RUNNER_KEY = "sum-of-best:last-runner";
const PREFERENCES_EVENT = "sum-of-best:preferences";
const FOCUS_SEARCH_EVENT = "sum-of-best:focus-search";

async function lookupUser(username: string, signal: AbortSignal) {
  const params = new URLSearchParams({ username });
  const response = await fetch(`/api/lookup?${params.toString()}`, { signal });
  const payload = (await response.json()) as LookupResult & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "That username could not be found.");
  }

  return payload;
}

function subscribePreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCES_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCES_EVENT, callback);
  };
}

function readRememberedRunner() {
  return window.localStorage.getItem(RUNNER_KEY) ?? "";
}

function notifyPreferenceChange() {
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

export default function V2LandingPage() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [phase, setPhase] = useState<LookupPhase>("idle");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const cleanUsername = username.trim().replace(/^@/, "");
  const isLoading = phase === "loading";
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const rememberedRunnerJson = useSyncExternalStore(
    subscribePreferences,
    readRememberedRunner,
    () => "",
  );
  const remembered = useMemo(() => {
    if (!rememberedRunnerJson) return null;

    try {
      const parsed = JSON.parse(rememberedRunnerJson) as RememberedRunner;
      return parsed.name && parsed.archiveUrl ? parsed : null;
    } catch {
      return null;
    }
  }, [rememberedRunnerJson]);
  const showRemembered = hydrated && remembered && !showSearch;

  useEffect(() => {
    if (cleanUsername.length < 2) return;

    const timeout = window.setTimeout(async () => {
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const payload = await lookupUser(cleanUsername, controller.signal);
        setResult(payload);
        setPhase("success");
        setMessage(`Found ${payload.name}.`);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResult(null);
        setPhase("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "The lookup failed. Try again.",
        );
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      requestRef.current?.abort();
    };
  }, [cleanUsername]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    function focusSearch() {
      setShowSearch(true);

      window.requestAnimationFrame(() => {
        const input = document.getElementById(
          "v2-speedrun-username",
        ) as HTMLInputElement | null;
        input?.focus({ preventScroll: true });
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      });
    }

    window.addEventListener(FOCUS_SEARCH_EVENT, focusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusSearch);
  }, []);

  useEffect(() => {
    if (!archiveTarget) return;

    let navigationFrame = 0;
    const paintFrame = window.requestAnimationFrame(() => {
      navigationFrame = window.requestAnimationFrame(() => {
        window.location.assign(archiveTarget);
      });
    });

    return () => {
      window.cancelAnimationFrame(paintFrame);
      if (navigationFrame) window.cancelAnimationFrame(navigationFrame);
    };
  }, [archiveTarget]);

  function rememberRunner(payload: LookupResult) {
    if (!payload.archiveUrl) return;

    const nextRunner: RememberedRunner = {
      name: payload.name,
      country: payload.country,
      avatar: payload.avatar,
      archiveUrl: payload.archiveUrl,
    };
    window.localStorage.setItem(RUNNER_KEY, JSON.stringify(nextRunner));
    notifyPreferenceChange();
  }

  function openArchive(url: string) {
    requestRef.current?.abort();
    setArchiveTarget(url);
  }

  function openArchiveLink(
    event: MouseEvent<HTMLAnchorElement>,
    url: string,
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    openArchive(url);
  }

  function updateUsername(value: string) {
    const cleanValue = value.trim().replace(/^@/, "");
    requestRef.current?.abort();
    setUsername(value);
    setResult(null);
    setAvatarFailed(false);

    if (!cleanValue) {
      setPhase("idle");
      setMessage("");
    } else if (cleanValue.length < 2) {
      setPhase("typing");
      setMessage("");
    } else {
      setPhase("loading");
      setMessage(`Looking for ${cleanValue}...`);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cleanUsername) {
      setPhase("error");
      setMessage("Enter a speedrun.com username.");
      return;
    }

    if (result?.archiveUrl) {
      rememberRunner(result);
      openArchive(result.archiveUrl);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPhase("loading");
    setMessage(`Looking for ${cleanUsername}...`);

    try {
      const payload = await lookupUser(cleanUsername, controller.signal);
      setResult(payload);
      setPhase("success");
      if (payload.archiveUrl) {
        rememberRunner(payload);
        openArchive(payload.archiveUrl);
      } else {
        setMessage("Profile found, but its archive could not be opened.");
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setResult(null);
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "The lookup failed.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  if (archiveTarget) return <ArchiveLoadingView />;

  return (
    <main className="v2-landing">
      <header className="v2-archive-header">
        <Link href="/" className="v2-archive-brand" aria-label="Sum of Best home">
          <strong>SUM OF BEST</strong>
        </Link>
      </header>

      <section className="v2-archive-hero" aria-labelledby="v2-title">
        <div className="v2-archive-intro">
          <h1 id="v2-title">
            Sum of <span>Best</span>
          </h1>
          <p>Your personal PB Archive</p>
        </div>

        <div className="v2-search-panel">
          {!hydrated ? (
            <div className="v2-search-loading" aria-hidden="true" />
          ) : showRemembered ? (
            <div className="v2-returning">
              <span className="v2-panel-label">LAST ARCHIVE</span>
              <div className="v2-returning-runner">
                {remembered.avatar ? (
                  <Image
                    src={remembered.avatar}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span aria-hidden="true">
                    {remembered.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <strong>@{remembered.name}</strong>
              </div>
              <Link
                className="v2-returning-open"
                href={remembered.archiveUrl!}
                onClick={(event) => openArchiveLink(event, remembered.archiveUrl!)}
              >
                OPEN ARCHIVE
              </Link>
              <button
                className="v2-use-another"
                type="button"
                onClick={() => setShowSearch(true)}
              >
                LOOK FOR ANOTHER USER
              </button>
            </div>
          ) : (
            <form className="v2-search" onSubmit={submit} noValidate>
              <label htmlFor="v2-speedrun-username">SPEEDRUN.COM USERNAME</label>
              <div className="v2-search-row">
                <span aria-hidden="true">@</span>
                <input
                  id="v2-speedrun-username"
                  name="username"
                  value={username}
                  onChange={(event) => updateUsername(event.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby="v2-search-message"
                  aria-invalid={phase === "error"}
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? "SEARCHING..." : "OPEN ARCHIVE"}
                </button>
              </div>
              <p
                id="v2-search-message"
                className={`v2-search-message${phase === "error" ? " is-error" : ""}`}
                aria-live="polite"
              >
                {message}
              </p>

              {result && (
                <div className="v2-lookup-result">
                  {result.avatar && !avatarFailed ? (
                    <Image
                      src={result.avatar}
                      alt=""
                      width={44}
                      height={44}
                      unoptimized
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span className="v2-lookup-result-initial" aria-hidden="true">
                      {result.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="v2-lookup-result-copy">
                    <strong>{result.name}</strong>
                    <small>{result.country ?? "speedrun.com runner"}</small>
                  </span>
                  {result.archiveUrl && (
                    <Link
                      href={result.archiveUrl}
                      onClick={(event) => {
                        rememberRunner(result);
                        openArchiveLink(event, result.archiveUrl!);
                      }}
                    >
                      OPEN
                    </Link>
                  )}
                </div>
              )}
            </form>
          )}

        </div>

        <a className="v2-scroll-button" href="#archive-preview">
          <span>Check out a demo archive</span>
          <b aria-hidden="true">↓</b>
        </a>
      </section>
    </main>
  );
}
