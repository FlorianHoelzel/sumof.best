"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import ArchiveShareDialog from "./archive-share-dialog";
import {
  archiveId,
  archiveStyle,
  displayDate,
  historyAnchor,
  historyLabel,
  timingMethodLabel,
} from "./archive-view";
import UserHeader from "./user-header";

export type Run = {
  id: string;
  date: string;
  seconds: number;
  time: string;
  video: string | null;
  runUrl: string;
  platform: string | null;
  emulated: boolean;
  detail: string | null;
  current: boolean;
};

export type TimingMethod =
  | "realtime"
  | "realtime_noloads"
  | "ingame"
  | "primary";

export type History = {
  id: string;
  gameId: string;
  gameName: string;
  gameAbbreviation: string;
  gameCover: string | null;
  categoryName: string;
  levelName: string | null;
  variant: string | null;
  timingMethod?: TimingMethod;
  runs: Run[];
};

export type SiteData = {
  generatedAt: string;
  source: string;
  profile: {
    name: string;
    country: string | null;
    avatar: string | null;
    nameColor?: { from: string | null; to: string | null } | null;
    profileUrl: string;
  };
  stats: {
    verifiedRuns: number;
    platforms: number;
    totalRunSeconds: number;
    pbRuns: number;
    games: number;
    histories: number;
  };
  histories: History[];
};

function compactDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function compactPreciseDuration(totalSeconds: number) {
  const totalMilliseconds = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  const secondsLabel = milliseconds
    ? `${seconds}.${String(milliseconds).padStart(3, "0")}s`
    : `${seconds}s`;

  if (hours) return `${hours}h ${minutes}m ${secondsLabel}`;
  if (minutes) return `${minutes}m ${secondsLabel}`;
  return secondsLabel;
}

function embedUrl(url: string | null, twitchParent: string | null = null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");
    if (host === "youtu.be") {
      return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}?autoplay=0&rel=0`;
    }
    if (host.includes("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ??
        parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      return id
        ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`
        : null;
    }
    if (host.includes("twitch.tv") && twitchParent) {
      const vod = parsed.pathname.match(/\/videos\/(\d+)/)?.[1];
      if (vod) {
        return `https://player.twitch.tv/?video=v${vod}&parent=${twitchParent}&autoplay=false`;
      }
      const clip = host.startsWith("clips.")
        ? parsed.pathname.split("/").filter(Boolean)[0]
        : parsed.pathname.match(/\/clip\/([^/?]+)/)?.[1];
      if (clip) {
        return `https://clips.twitch.tv/embed?clip=${clip}&parent=${twitchParent}&autoplay=false`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function ProgressChart({
  runs,
  selected,
  onSelect,
  gameName,
  categoryLabel,
  timeLabel,
}: {
  runs: Run[];
  selected: number;
  onSelect: (index: number) => void;
  gameName: string;
  categoryLabel: string;
  timeLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = `chart-accent-${useId().replace(/:/g, "")}`;
  const gradientPaint = `url(#${gradientId})`;
  const width = 700;
  const height = 250;
  const padX = 28;
  const padY = 30;
  const values = runs.map((run) => run.seconds);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = runs.map((run, index) => ({
    x:
      runs.length === 1
        ? width / 2
        : padX + (index / (runs.length - 1)) * (width - padX * 2),
    y: padY + ((max - run.seconds) / span) * (height - padY * 2),
  }));
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const totalSaved =
    runs.length > 1
      ? `${Math.round(runs[0].seconds - runs.at(-1)!.seconds)}s SAVED`
      : "CURRENT PB";

  return (
    <div className="chart-wrap">
      <div className="chart-labels">
        <span>{timeLabel}</span>
        <span>{runs.length} PB{runs.length === 1 ? "" : "S"}</span>
      </div>
      <div className="chart-stage">
        <span className="chart-improvement">{totalSaved}</span>
        <svg
          className="chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Personal best time progression"
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="28"
              y1="0"
              x2="672"
              y2="0"
            >
              <stop offset="0%" stopColor="var(--acid)" />
              <stop offset="100%" stopColor="var(--acid-secondary)" />
            </linearGradient>
          </defs>
          <line x1="28" y1="30" x2="28" y2="220" className="axis" />
          <line x1="28" y1="220" x2="672" y2="220" className="axis" />
          <path
            d={path}
            className="chart-line"
            style={{ stroke: gradientPaint }}
          />
          {points.map((point, index) => (
            <circle
              key={runs[index].id}
              cx={point.x}
              cy={point.y}
              r={selected === index ? 6 : 3.5}
              className={selected === index ? "chart-dot active" : "chart-dot"}
              style={{
                stroke: gradientPaint,
                fill:
                  selected === index || hovered === index
                    ? gradientPaint
                    : "var(--panel)",
              }}
              role="button"
              tabIndex={0}
              aria-label={`${displayDate(runs[index].date)}, ${runs[index].time}`}
              onClick={() => onSelect(index)}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(index);
              }}
            />
          ))}
        </svg>
        {hovered !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(points[hovered].x / width) * 100}%`,
              top: `${(points[hovered].y / height) * 100}%`,
            }}
          >
            <b>{gameName}</b>
            <span>{runs[hovered].detail ?? categoryLabel}</span>
            <strong>{runs[hovered].time}</strong>
            <small>{displayDate(runs[hovered].date)}</small>
          </div>
        )}
      </div>
      <div className="chart-range">
        <span>{displayDate(runs[0].date)}</span>
        <span>{displayDate(runs[runs.length - 1].date)}</span>
      </div>
    </div>
  );
}

function HistoryBlock({
  history,
  index,
  username,
}: {
  history: History;
  index: number;
  username: string;
}) {
  const [selected, setSelected] = useState(history.runs.length - 1);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const twitchParent =
    showEmbed && typeof window !== "undefined" ? window.location.hostname : null;
  const run = history.runs[selected];
  const embed = embedUrl(run.video, twitchParent);
  const embedPath = `/${encodeURIComponent(username)}/embed/${encodeURIComponent(history.id)}`;
  const embedSource =
    typeof window === "undefined"
      ? embedPath
      : `${window.location.origin}${embedPath}`;
  const embedCode = `<iframe src="${embedSource}" width="960" height="540" title="${history.gameName} PB history" loading="lazy"></iframe>`;
  const title = [history.categoryName, history.levelName, history.variant]
    .filter(Boolean)
    .join(" · ");

  function chooseRun(runIndex: number) {
    setSelected(runIndex);
  }

  return (
    <article
      className="history-card"
      id={historyAnchor(history)}
      data-archive-id={historyAnchor(history)}
      style={{ "--delay": `${Math.min(index % 5, 4) * 70}ms` } as React.CSSProperties}
    >
      <div className="history-heading">
        <div>
          <span className="eyebrow">
            {history.levelName ? "INDIVIDUAL LEVEL" : "FULL GAME"}
          </span>
          <h3>{title}</h3>
        </div>
        <div className="history-actions">
          <button
            className="embed-trigger"
            type="button"
            onClick={() => setShowShare(true)}
          >
            SHARE
          </button>
          <button
            className="embed-trigger"
            type="button"
            onClick={() => {
              setCopied(false);
              setShowEmbed(true);
            }}
          >
            EMBED
          </button>
        </div>
      </div>

      <div className="history-layout">
        <section className="video-panel" aria-label={`Video for ${title}`}>
          <div className="video-topline">
            <span>RUN FOOTAGE</span>
            <span>{displayDate(run.date)}</span>
          </div>
          <div className="video-frame">
            {embed ? (
              <iframe
                key={run.id}
                src={embed}
                title={`${history.gameName} ${title} in ${run.time}`}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <div className="video-fallback">
                <span className="fallback-mark" aria-hidden="true">
                  <span className="fallback-play" />
                </span>
                <p>{run.video ? "This video can’t be embedded." : "No video was attached to this run."}</p>
                <a href={run.video ?? run.runUrl} target="_blank" rel="noreferrer">
                  {run.video ? "Open video" : "View run"}
                </a>
              </div>
            )}
          </div>
          <div className="now-playing">
            <span>NOW PLAYING</span>
            <strong>{run.time}</strong>
            <span>{run.platform}{run.emulated ? " · EMU" : ""}</span>
          </div>
        </section>

        <div className="history-data">
          <ProgressChart
            runs={history.runs}
            selected={selected}
            onSelect={chooseRun}
            gameName={history.gameName}
            categoryLabel={title}
            timeLabel={timingMethodLabel(history.timingMethod)}
          />
          <section className="runs-panel">
            <div className="table-heading">
              <span>PB HISTORY</span>
              <span>SELECT A RUN</span>
            </div>
            <div className="run-list">
              {history.runs
                .map((item, runIndex) => ({ item, runIndex }))
                .reverse()
                .map(({ item, runIndex }) => (
                  <button
                    className={runIndex === selected ? "run-row active" : "run-row"}
                    key={item.id}
                    type="button"
                    data-pb-run-id={item.id}
                    onClick={() => chooseRun(runIndex)}
                    aria-pressed={runIndex === selected}
                  >
                    <span className="row-dot" />
                    <span className="row-date">
                      <span>{displayDate(item.date)}</span>
                      {item.detail && <small>{item.detail}</small>}
                    </span>
                    <strong>{item.time}</strong>
                    <span className="row-action">PLAY ↗</span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
      {showEmbed &&
        typeof document !== "undefined" &&
        createPortal(
          <div
          className="embed-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowEmbed(false);
          }}
        >
          <section
            className="embed-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Embed ${history.gameName} ${title}`}
          >
            <div className="embed-dialog-heading">
              <div>
                <span>EMBED THIS CATEGORY</span>
                <h4>
                  {history.gameName} · {title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowEmbed(false)}
                aria-label="Close embed dialog"
              >
                ×
              </button>
            </div>
            <p>
              Paste this iframe into a website to show the interactive PB graph
              and history.
            </p>
            <div className="embed-live-preview">
              <div className="embed-live-preview-heading">
                <span>LIVE EMBED PREVIEW</span>
                <div className="embed-preview-switcher" aria-label="Preview size">
                  <button
                    type="button"
                    className="active"
                    aria-pressed="true"
                  >
                    16:9
                  </button>
                  <button
                    type="button"
                    disabled
                  >
                    TWITCH · COMING SOON
                  </button>
                </div>
              </div>
              <iframe
                src={embedPath}
                title={`Preview of ${history.gameName} ${title} PB history`}
                loading="lazy"
              />
            </div>
            <textarea
              readOnly
              value={embedCode}
              aria-label="Embed code"
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="embed-dialog-actions">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(embedCode);
                  setCopied(true);
                }}
              >
                {copied ? "COPIED" : "COPY CODE"}
              </button>
              <a href={embedPath} target="_blank" rel="noreferrer">
                OPEN FULL SIZE ↗
              </a>
            </div>
          </section>
          </div>,
          document.body,
        )}
      {showShare && (
        <ArchiveShareDialog
          username={username}
          historyId={history.id}
          historyAnchor={historyAnchor(history)}
          gameName={history.gameName}
          categoryLabel={title}
          onClose={() => setShowShare(false)}
        />
      )}
    </article>
  );
}

function LevelCollection({
  histories,
  username,
}: {
  histories: History[];
  username: string;
}) {
  const [activeId, setActiveId] = useState(histories[0].id);
  const active =
    histories.find((history) => history.id === activeId) ?? histories[0];

  useEffect(() => {
    function selectHashTarget() {
      const target = window.location.hash.slice(1);
      const selectedHistory = histories.find(
        (history) => historyAnchor(history) === target,
      );
      if (selectedHistory) setActiveId(selectedHistory.id);
    }

    selectHashTarget();
    window.addEventListener("hashchange", selectHashTarget);
    return () => window.removeEventListener("hashchange", selectHashTarget);
  }, [histories]);

  useEffect(() => {
    function selectRunHistory(event: Event) {
      const { historyId } = (
        event as CustomEvent<{ historyId: string }>
      ).detail;
      if (histories.some((history) => history.id === historyId)) {
        setActiveId(historyId);
      }
    }

    window.addEventListener("sumofbest:select-run", selectRunHistory);
    return () =>
      window.removeEventListener("sumofbest:select-run", selectRunHistory);
  }, [histories]);

  useEffect(() => {
    if (window.location.hash !== `#${historyAnchor(active)}`) return;
    requestAnimationFrame(() => {
      document
        .getElementById(historyAnchor(active))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [active]);

  return (
    <section className="level-collection">
      <div className="level-picker">
        <span>
          <b>INDIVIDUAL LEVELS</b>
          {histories.length} leaderboards grouped here
        </span>
        <label>
          <span>SELECT LEVEL</span>
          <select
            value={activeId}
            onChange={(event) => setActiveId(event.target.value)}
            aria-label="Select an individual level"
          >
            {histories.map((history) => (
              <option key={history.id} value={history.id}>
                {[history.levelName, history.variant].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <HistoryBlock
        history={active}
        index={0}
        username={username}
        key={active.id}
      />
    </section>
  );
}

type ArchiveGame = {
  name: string;
  id: string;
  gameAbbreviation: string;
  cover: string | null;
  histories: History[];
  displayCount: number;
};

function archiveGames(histories: History[]): ArchiveGame[] {
  const grouped = new Map<string, History[]>();
  for (const history of histories) {
    const existing = grouped.get(history.gameName) ?? [];
    existing.push(history);
    grouped.set(history.gameName, existing);
  }

  return [...grouped.entries()].map(([name, gameHistories]) => {
    const groupedLevels = gameHistories.filter((history) => history.levelName);
    return {
      name,
      id: archiveId(name),
      gameAbbreviation: gameHistories[0].gameAbbreviation,
      cover: gameHistories[0].gameCover,
      histories: gameHistories,
      displayCount:
        gameHistories.length -
        groupedLevels.length +
        (groupedLevels.length ? 1 : 0),
    };
  });
}

type PassportGame = ArchiveGame & {
  firstYear: number | null;
  latestYear: number | null;
  platforms: string[];
  pbCount: number;
  categories: number;
  totalSaved: number;
  biggestSave: {
    seconds: number;
    category: string;
  } | null;
};

function passportGame(game: ArchiveGame): PassportGame {
  const datedRuns = game.histories
    .flatMap((history) => history.runs)
    .filter((run) => run.date !== "Unknown");
  const years = datedRuns.map((run) =>
    new Date(`${run.date}T00:00:00Z`).getUTCFullYear(),
  );
  const platforms = [
    ...new Set(
      game.histories
        .flatMap((history) => history.runs)
        .map((run) => run.platform)
        .filter((platform): platform is string => Boolean(platform)),
    ),
  ];
  let totalSaved = 0;
  let biggestSave: PassportGame["biggestSave"] = null;

  for (const history of game.histories) {
    if (history.runs.length > 1) {
      totalSaved += history.runs[0].seconds - history.runs.at(-1)!.seconds;
    }
    for (let index = 1; index < history.runs.length; index += 1) {
      const seconds =
        history.runs[index - 1].seconds - history.runs[index].seconds;
      if (!biggestSave || seconds > biggestSave.seconds) {
        biggestSave = {
          seconds,
          category: historyLabel(history),
        };
      }
    }
  }

  return {
    ...game,
    firstYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    platforms,
    pbCount: game.histories.reduce(
      (total, history) => total + history.runs.length,
      0,
    ),
    categories: game.histories.length,
    totalSaved,
    biggestSave,
  };
}

export function SpeedrunPassport({
  histories,
  owner,
  archivePath,
  embedded = false,
}: {
  histories: History[];
  owner: string;
  archivePath: string;
  embedded?: boolean;
}) {
  const games = useMemo(() => archiveGames(histories), [histories]);
  const entries = useMemo(() => games.map(passportGame), [games]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous">(
    "next",
  );
  const [turnPhase, setTurnPhase] = useState<"idle" | "out" | "in">("idle");
  const game = entries[activeIndex];

  useEffect(() => {
    if (turnPhase === "out" && pendingIndex !== null) {
      const timer = window.setTimeout(() => {
        setActiveIndex(pendingIndex);
        setTurnPhase("in");
      }, 140);
      return () => window.clearTimeout(timer);
    }

    if (turnPhase === "in") {
      const timer = window.setTimeout(() => {
        setTurnPhase("idle");
        setPendingIndex(null);
      }, 180);
      return () => window.clearTimeout(timer);
    }
  }, [pendingIndex, turnPhase]);

  function turnTo(index: number) {
    if (
      turnPhase !== "idle" ||
      index < 0 ||
      index >= entries.length ||
      index === activeIndex
    ) {
      return;
    }
    setTurnDirection(index > activeIndex ? "next" : "previous");
    setPendingIndex(index);
    setTurnPhase("out");
  }

  return (
    <div
      className="passport"
      role="region"
      aria-label={`${owner}'s speedrun passport`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") turnTo(activeIndex - 1);
        if (event.key === "ArrowRight") turnTo(activeIndex + 1);
      }}
    >
      <div className="passport-book-topline">
        <span>SUM OF BEST · SPEEDRUN PASSPORT</span>
        <b>{owner.toUpperCase()}</b>
      </div>

      <div
        className={`passport-spread turn-${turnDirection} phase-${turnPhase}`}
        aria-live="polite"
      >
        <section className="passport-page passport-page-identity">
          <div className="passport-page-heading">
            <span>GAME ENTRY</span>
            <b>{String(activeIndex + 1).padStart(2, "0")}</b>
          </div>
          <div className="passport-identity">
            <div className="passport-cover" aria-hidden="true">
              {game.cover ? (
                <img src={game.cover} alt="" loading="lazy" />
              ) : (
                <span>{game.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <span className="passport-kicker">SPEEDRUN VISA</span>
              <h3>{game.name}</h3>
              <small>VALID FOR VERIFIED PERSONAL BESTS</small>
            </div>
          </div>

          <div className="passport-fields">
            <div>
              <span>HOLDER</span>
              <strong>{owner}</strong>
            </div>
            <div>
              <span>ACTIVE YEARS</span>
              <strong>
                {game.firstYear && game.latestYear
                  ? game.firstYear === game.latestYear
                    ? game.firstYear
                    : `${game.firstYear}-${game.latestYear}`
                  : "UNKNOWN"}
              </strong>
            </div>
            <div>
              <span>CATEGORIES</span>
              <strong>{game.displayCount}</strong>
            </div>
            <div>
              <span>PLATFORMS</span>
              <strong>
                {game.platforms.length
                  ? game.platforms.slice(0, 3).join(" / ")
                  : "UNKNOWN"}
              </strong>
            </div>
          </div>

          <div
            className={`passport-stamp stamp-${activeIndex % 4}`}
            aria-hidden="true"
          >
            <span>PB</span>
            <b>{game.latestYear ?? "RUN"}</b>
            <small>ADMITTED</small>
          </div>
          <span className="passport-page-number">
            {String(activeIndex * 2 + 1).padStart(2, "0")}
          </span>
        </section>

        <section className="passport-page passport-page-record">
          <div className="passport-page-heading">
            <span>ENTRY RECORD</span>
            <b>{game.gameAbbreviation ?? "PB"}</b>
          </div>
          <div className="passport-record-title">
            <span>ARCHIVE MARKS</span>
            <h3>{game.pbCount} personal bests</h3>
          </div>

          <div className="passport-stats">
            <div>
              <span>PB STAMPS</span>
              <strong>{game.pbCount}</strong>
            </div>
            <div>
              <span>TIME CUT</span>
              <strong>{compactDuration(game.totalSaved)}</strong>
            </div>
            <div>
              <span>CATEGORIES</span>
              <strong>{game.categories}</strong>
            </div>
          </div>

          <div className="passport-landmark">
            <span>BIGGEST LEAP</span>
            <strong>
              {game.biggestSave
                ? `−${compactDuration(game.biggestSave.seconds)}`
                : "FIRST PB"}
            </strong>
            <small>
              {game.biggestSave?.category ?? "The journey starts here"}
            </small>
          </div>

          <a
            className="passport-open"
            href={`${archivePath}#${game.id}`}
            target={embedded ? "_blank" : undefined}
            rel={embedded ? "noreferrer" : undefined}
          >
            OPEN {game.name.toUpperCase()} HISTORY ↓
          </a>
          <span className="passport-page-number">
            {String(activeIndex * 2 + 2).padStart(2, "0")}
          </span>
        </section>
      </div>

      <div className="passport-controls">
        <button
          type="button"
          onClick={() => turnTo(activeIndex - 1)}
          disabled={activeIndex === 0 || turnPhase !== "idle"}
        >
          ← PREVIOUS
        </button>
        <div className="passport-progress" aria-label="Passport pages">
          {entries.map((entry, index) => (
            <button
              type="button"
              className={index === activeIndex ? "active" : ""}
              onClick={() => turnTo(index)}
              disabled={turnPhase !== "idle"}
              aria-label={`Turn to ${entry.name}`}
              aria-current={index === activeIndex ? "page" : undefined}
              key={entry.id}
            >
              <span />
            </button>
          ))}
        </div>
        <span className="passport-counter">
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(entries.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => turnTo(activeIndex + 1)}
          disabled={
            activeIndex === entries.length - 1 || turnPhase !== "idle"
          }
        >
          NEXT →
        </button>
      </div>
    </div>
  );
}

function resetGameCover(cover: HTMLElement | null) {
  if (!cover) return;
  cover.style.removeProperty("--cover-rotate-x");
  cover.style.removeProperty("--cover-rotate-y");
  cover.style.removeProperty("--cover-shine-x");
  cover.style.removeProperty("--cover-shine-y");
  delete cover.dataset.parallaxActive;
}

function GameHeading({
  game,
  index,
}: {
  game: ArchiveGame;
  index: number;
}) {
  return (
    <header
      className="game-heading"
      data-archive-id={game.id}
      onPointerMove={(event) => {
        if (
          event.pointerType === "mouse" &&
          event.target instanceof Element &&
          !event.target.closest(".game-cover")
        ) {
          resetGameCover(
            event.currentTarget.querySelector<HTMLElement>(".game-cover"),
          );
        }
      }}
      onPointerLeave={(event) => {
        resetGameCover(
          event.currentTarget.querySelector<HTMLElement>(".game-cover"),
        );
      }}
    >
      <span className="game-number">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="game-heading-copy">
        <div className="game-heading-meta">
          <span>SUM OF BEST</span>
          <i aria-hidden="true" />
          <span>
            {game.histories.length} CATEGOR
            {game.histories.length === 1 ? "Y" : "IES"}
          </span>
        </div>
        <h2>{game.name}</h2>
      </div>
      <span className="game-monogram" aria-hidden="true">
        {game.gameAbbreviation}
      </span>
      {game.cover && (
        <span
          className="game-cover"
          aria-hidden="true"
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse") return;

            const cover = event.currentTarget;
            const bounds = cover.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width;
            const y = (event.clientY - bounds.top) / bounds.height;

            cover.style.setProperty("--cover-rotate-x", `${(0.5 - y) * 12}deg`);
            cover.style.setProperty("--cover-rotate-y", `${(x - 0.5) * 14}deg`);
            cover.style.setProperty("--cover-shine-x", `${x * 100}%`);
            cover.style.setProperty("--cover-shine-y", `${y * 100}%`);
            cover.dataset.parallaxActive = "true";
          }}
          onPointerLeave={(event) => {
            resetGameCover(event.currentTarget);
          }}
        >
          <img
            src={game.cover}
            alt=""
            width="104"
            height="139"
            loading="lazy"
          />
          <span className="game-cover-shine" />
        </span>
      )}
    </header>
  );
}

function ArchiveNavigator({ games }: { games: ArchiveGame[] }) {
  const [activeId, setActiveId] = useState("overview");

  useEffect(() => {
    let frame = 0;

    function updateActiveSection() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = Array.from(
          document.querySelectorAll<HTMLElement>("[data-archive-id]"),
        );
        let current = sections[0]?.dataset.archiveId ?? "overview";
        for (const section of sections) {
          if (section.getBoundingClientRect().top > 150) break;
          current = section.dataset.archiveId ?? current;
        }
        setActiveId(current);
      });
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("hashchange", updateActiveSection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("hashchange", updateActiveSection);
    };
  }, []);

  const activeGame =
    games.find(
      (game) =>
        activeId === game.id ||
        game.histories.some((history) => historyAnchor(history) === activeId),
    )?.id ?? null;

  function jumpTo(id: string) {
    window.location.hash = id;
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <aside className="archive-navigator" aria-label="Archive navigator">
        <div className="archive-navigator-heading">
          <span>ARCHIVE NAVIGATOR</span>
          <b>{games.length} GAMES</b>
        </div>
        <nav>
          <a
            className={activeId === "overview" ? "active" : ""}
            href="#overview"
          >
            <span>00</span>
            OVERVIEW
          </a>
          <a className={activeId === "games" ? "active" : ""} href="#games">
            <span>→</span>
            GAME INDEX
          </a>
          {games.map((game, gameIndex) => (
            <div
              className={activeGame === game.id ? "navigator-game active" : "navigator-game"}
              key={game.id}
            >
              <a href={`#${game.id}`}>
                <span>{String(gameIndex + 1).padStart(2, "0")}</span>
                <b>{game.name}</b>
              </a>
              <div className="navigator-categories">
                {game.histories
                  .filter((history) => !history.levelName)
                  .map((history) => {
                  const anchor = historyAnchor(history);
                  return (
                    <a
                      className={activeId === anchor ? "active" : ""}
                      href={`#${anchor}`}
                      key={history.id}
                    >
                      {historyLabel(history)}
                    </a>
                  );
                  })}
                {game.histories.some((history) => history.levelName) && (() => {
                  const levels = game.histories.filter(
                    (history) => history.levelName,
                  );
                  const anchors = levels.map(historyAnchor);
                  return (
                    <a
                      className={anchors.includes(activeId) ? "active" : ""}
                      href={`#${anchors[0]}`}
                    >
                      Individual Levels · {levels.length}
                    </a>
                  );
                })()}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <label className="archive-navigator-mobile">
        <span>JUMP TO</span>
        <select
          aria-label="Jump to a game or category"
          value={activeId}
          onChange={(event) => jumpTo(event.target.value)}
        >
          <option value="overview">Archive overview</option>
          <option value="games">Game index</option>
          {games.map((game) => (
            <optgroup label={game.name} key={game.id}>
              <option value={game.id}>{game.name}</option>
              {game.histories
                .filter((history) => !history.levelName)
                .map((history) => (
                <option value={historyAnchor(history)} key={history.id}>
                  {historyLabel(history)}
                </option>
                ))}
              {game.histories.some((history) => history.levelName) && (() => {
                const levels = game.histories.filter(
                  (history) => history.levelName,
                );
                return (
                  <option value={historyAnchor(levels[0])}>
                    Individual Levels · {levels.length}
                  </option>
                );
              })()}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}

function ArchiveOverview({ histories }: { histories: History[] }) {
  const overview = useMemo(() => {
    const runs = histories
      .flatMap((history) =>
        history.runs.map((run) => ({
          ...run,
          historyId: history.id,
          gameName: history.gameName,
          categoryLabel: historyLabel(history),
        })),
      )
      .filter((run) => run.date !== "Unknown");

    const years = new Map<number, number>();
    const games = new Map<string, number>();
    const platforms = new Map<string, number>();
    const days = new Map<string, number>();
    const activeMonths = new Map<number, number>();

    for (const run of runs) {
      const date = new Date(`${run.date}T00:00:00Z`);
      const year = date.getUTCFullYear();
      years.set(year, (years.get(year) ?? 0) + 1);
      games.set(run.gameName, (games.get(run.gameName) ?? 0) + 1);
      days.set(run.date, (days.get(run.date) ?? 0) + 1);
      const monthKey = year * 12 + date.getUTCMonth();
      activeMonths.set(monthKey, (activeMonths.get(monthKey) ?? 0) + 1);
      if (run.platform) {
        platforms.set(run.platform, (platforms.get(run.platform) ?? 0) + 1);
      }
    }

    const observedYears = [...years.keys()];
    const firstYear = Math.min(...observedYears);
    const lastYear = Math.max(...observedYears);
    const yearEntries = Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => {
        const year = firstYear + index;
        return [year, years.get(year) ?? 0] as [number, number];
      },
    );
    const gameEntries = [...games.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const platformEntries = [...platforms.entries()].sort((a, b) => b[1] - a[1]);
    const peakYear = [...yearEntries].sort((a, b) => b[1] - a[1])[0];
    const latest = [...runs].sort((a, b) => b.date.localeCompare(a.date))[0];
    const peakYearValue = peakYear?.[0];
    const peakRuns = peakYearValue
      ? runs.filter(
          (run) =>
            new Date(`${run.date}T00:00:00Z`).getUTCFullYear() ===
            peakYearValue,
        )
      : [];
    const peakMonths = Array.from({ length: 12 }, () => 0);
    const peakGames = new Map<string, number>();
    for (const run of peakRuns) {
      const month = new Date(`${run.date}T00:00:00Z`).getUTCMonth();
      peakMonths[month] += 1;
      peakGames.set(run.gameName, (peakGames.get(run.gameName) ?? 0) + 1);
    }
    const busiestMonthIndex = peakMonths.indexOf(Math.max(...peakMonths));
    const topPeakGame = [...peakGames.entries()].sort((a, b) => b[1] - a[1])[0];
    let peakBiggestSave = {
      seconds: 0,
      gameName: "",
      categoryLabel: "",
    };
    for (const history of histories) {
      for (let index = 1; index < history.runs.length; index += 1) {
        const run = history.runs[index];
        if (
          run.date === "Unknown" ||
          new Date(`${run.date}T00:00:00Z`).getUTCFullYear() !== peakYearValue
        ) {
          continue;
        }
        const saved = history.runs[index - 1].seconds - run.seconds;
        if (saved > peakBiggestSave.seconds) {
          peakBiggestSave = {
            seconds: saved,
            gameName: history.gameName,
            categoryLabel: historyLabel(history),
          };
        }
      }
    }
    const monthKeys = [...activeMonths.keys()].sort((a, b) => a - b);
    let currentStreak = monthKeys.length ? 1 : 0;
    let longestStreak = currentStreak;
    for (let index = 1; index < monthKeys.length; index += 1) {
      currentStreak =
        monthKeys[index] === monthKeys[index - 1] + 1 ? currentStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    }

    let totalSaved = 0;
    let biggestSave = {
      seconds: 0,
      gameName: "",
      categoryLabel: "",
    };
    for (const history of histories) {
      if (history.runs.length > 1) {
        totalSaved +=
          history.runs[0].seconds - history.runs.at(-1)!.seconds;
      }
      for (let index = 1; index < history.runs.length; index += 1) {
        const saved =
          history.runs[index - 1].seconds - history.runs[index].seconds;
        if (saved > biggestSave.seconds) {
          biggestSave = {
            seconds: saved,
            gameName: history.gameName,
            categoryLabel: historyLabel(history),
          };
        }
      }
    }

    const yearsActive =
      yearEntries.length > 0
        ? yearEntries.at(-1)![0] - yearEntries[0][0] + 1
        : 0;
    const milestoneName =
      runs.length >= 100
        ? "CENTURY CLUB"
        : runs.length >= 50
          ? "HALF CENTURY"
          : runs.length >= 25
            ? "QUARTER CENTURY"
            : "ON THE BOARD";
    const enduranceName =
      yearsActive >= 10
        ? "DECADE RUNNER"
        : yearsActive >= 5
          ? "LONG HAUL"
          : "MOMENTUM";
    return {
      runs,
      years: yearEntries,
      games: gameEntries,
      platforms: platformEntries,
      peakYear,
      latest,
      maxYear: Math.max(...yearEntries.map((entry) => entry[1])),
      maxGame: gameEntries[0]?.[1] ?? 1,
      platformTotal: platformEntries.reduce((sum, entry) => sum + entry[1], 0),
      days,
      peakBreakdown: {
        months: peakMonths,
        maxMonth: Math.max(1, ...peakMonths),
        activeMonths: peakMonths.filter(Boolean).length,
        busiestMonth: new Intl.DateTimeFormat("en", {
          month: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2020, Math.max(0, busiestMonthIndex), 1))),
        busiestMonthCount: Math.max(...peakMonths),
        topGame: topPeakGame?.[0] ?? "No game data",
        topGameCount: topPeakGame?.[1] ?? 0,
        biggestSave: peakBiggestSave,
      },
      achievements: [
        {
          name: milestoneName,
          value: String(runs.length),
          detail: "PB milestones archived",
        },
        {
          name: "TIME SHREDDER",
          value: compactDuration(totalSaved),
          detail: "Total time cut across every category",
        },
        {
          name: "GIANT LEAP",
          value: compactDuration(biggestSave.seconds),
          detail: biggestSave.gameName
            ? `${biggestSave.gameName} · ${biggestSave.categoryLabel}`
            : "Biggest single PB improvement",
        },
        {
          name: "HOT STREAK",
          value: `${longestStreak} mo`,
          detail: "Longest run of active PB months",
        },
        {
          name: enduranceName,
          value: `${yearsActive} yr`,
          detail: "Calendar years represented",
        },
      ],
    };
  }, [histories]);
  const [heatmapYear, setHeatmapYear] = useState(
    overview.years.at(-1)?.[0] ?? new Date().getUTCFullYear(),
  );
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(
    null,
  );
  const heatmapDialogRef = useRef<HTMLDialogElement>(null);
  const selectedDayRuns = useMemo(
    () =>
      selectedHeatmapDate
        ? overview.runs.filter((run) => run.date === selectedHeatmapDate)
        : [],
    [overview.runs, selectedHeatmapDate],
  );

  useLayoutEffect(() => {
    if (!selectedHeatmapDate) return;

    const dialog = heatmapDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [selectedHeatmapDate]);

  function jumpToRun(historyId: string, runId: string) {
    setSelectedHeatmapDate(null);
    const history = histories.find((item) => item.id === historyId);
    if (!history) return;

    window.location.assign(`#${historyAnchor(history)}`);
    window.dispatchEvent(
      new CustomEvent("sumofbest:select-run", {
        detail: { historyId, runId },
      }),
    );

    let attempts = 0;
    function selectAndScroll() {
      const target = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-pb-run-id]"),
      ).find((element) => element.dataset.pbRunId === runId);

      if (target) {
        target.click();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
        return;
      }

      attempts += 1;
      if (attempts < 4) requestAnimationFrame(selectAndScroll);
    }

    requestAnimationFrame(selectAndScroll);
  }

  const heatmap = useMemo(() => {
    const first = new Date(Date.UTC(heatmapYear, 0, 1));
    const last = new Date(Date.UTC(heatmapYear, 11, 31));
    const cells: Array<
      | { blank: true }
      | { blank: false; date: string; count: number; level: number }
    > = Array.from({ length: first.getUTCDay() }, () => ({ blank: true }));
    const counts = [...overview.days.entries()]
      .filter(([date]) => date.startsWith(`${heatmapYear}-`))
      .map(([, count]) => count);
    const maximum = Math.max(1, ...counts);

    for (
      let date = new Date(first);
      date <= last;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const key = date.toISOString().slice(0, 10);
      const count = overview.days.get(key) ?? 0;
      cells.push({
        blank: false,
        date: key,
        count,
        level: count ? Math.max(1, Math.ceil((count / maximum) * 4)) : 0,
      });
    }

    return { cells, total: counts.reduce((sum, count) => sum + count, 0) };
  }, [heatmapYear, overview.days]);

  return (
    <section className="archive-overview" id="overview" data-archive-id="overview">
      <div className="section-label">
        <span>01</span>
        <h2>ARCHIVE OVERVIEW</h2>
        <span>
          {overview.years[0]?.[0]}—{overview.years.at(-1)?.[0]}
        </span>
      </div>

      <div className="overview-grid">
        <article className="overview-card activity-card">
          <div className="overview-card-heading">
            <span>PB ACTIVITY</span>
            <span>IMPROVEMENTS BY YEAR</span>
          </div>
          <div
            className="year-bars"
            aria-label="Personal bests by year"
            style={
              { "--year-count": overview.years.length } as React.CSSProperties
            }
          >
            {overview.years.map(([year, count]) => (
              <div className="year-column" key={year}>
                <strong>{count}</strong>
                <span
                  className="year-bar"
                  style={{ height: `${Math.max(8, (count / overview.maxYear) * 100)}%` }}
                  title={`${year}: ${count} personal bests`}
                />
                <small>{year}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="overview-card top-games-card">
          <div className="overview-card-heading">
            <span>TOP GAMES</span>
            <span>BY PB MILESTONES</span>
          </div>
          <div className="ranked-games">
            {overview.games.map(([name, count], index) => (
              <a href={`#${archiveId(name)}`} key={name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{name}</b>
                  <i style={{ width: `${(count / overview.maxGame) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </a>
            ))}
          </div>
        </article>

        <article
          className={`overview-card heatmap-card${
            selectedHeatmapDate ? " popup-open" : ""
          }`}
        >
          <div className="overview-card-heading">
            <span>ACTIVITY HEATMAP</span>
            <label>
              <span className="sr-only">Select calendar year</span>
              <select
                value={heatmapYear}
                onChange={(event) => setHeatmapYear(Number(event.target.value))}
              >
                {overview.years
                  .map(([year]) => year)
                  .reverse()
                  .map((year) => (
                    <option value={year} key={year}>
                      {year}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="heatmap-summary">
            <strong>{heatmap.total}</strong>
            <span>
              PB {heatmap.total === 1 ? "milestone" : "milestones"} in{" "}
              {heatmapYear}
            </span>
          </div>
          <div className="heatmap-scroll">
            <div className="heatmap-months" aria-hidden="true">
              {[
                "JAN",
                "FEB",
                "MAR",
                "APR",
                "MAY",
                "JUN",
                "JUL",
                "AUG",
                "SEP",
                "OCT",
                "NOV",
                "DEC",
              ].map((month) => (
                <span key={month}>{month}</span>
              ))}
            </div>
            <div
              className="heatmap-grid"
              aria-label={`${heatmap.total} personal best milestones during ${heatmapYear}`}
            >
              {heatmap.cells.map((cell, index) =>
                cell.blank ? (
                  <span className="heatmap-day blank" key={`blank-${index}`} />
                ) : cell.count ? (
                  <button
                    className={`heatmap-day level-${cell.level}`}
                    type="button"
                    title={`${displayDate(cell.date)}: ${cell.count} PB${
                      cell.count === 1 ? "" : "s"
                    }`}
                    aria-label={`View ${cell.count} PB${
                      cell.count === 1 ? "" : "s"
                    } from ${displayDate(cell.date)}`}
                    onClick={() => setSelectedHeatmapDate(cell.date)}
                    key={cell.date}
                  />
                ) : (
                  <span
                    className={`heatmap-day level-${cell.level}`}
                    title={`${displayDate(cell.date)}: ${cell.count} PB${
                      cell.count === 1 ? "" : "s"
                    }`}
                    key={cell.date}
                  />
                ),
              )}
            </div>
          </div>
          <div className="heatmap-legend" aria-hidden="true">
            <span>LESS</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i className={`heatmap-day level-${level}`} key={level} />
            ))}
            <span>MORE</span>
          </div>
          {selectedHeatmapDate && (
            <dialog
              ref={heatmapDialogRef}
              className="heatmap-popup-overlay"
              aria-labelledby="heatmap-popup-title"
              onCancel={() => setSelectedHeatmapDate(null)}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedHeatmapDate(null);
                }
              }}
            >
              <section className="heatmap-popup">
                <div className="heatmap-popup-heading">
                  <div>
                    <span>PB ACTIVITY</span>
                    <h3 id="heatmap-popup-title">
                      {displayDate(selectedHeatmapDate)}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHeatmapDate(null)}
                    aria-label="Close PB activity popup"
                  >
                    ×
                  </button>
                </div>
                <p>
                  {selectedDayRuns.length} PB
                  {selectedDayRuns.length === 1 ? "" : "s"} set on this day
                </p>
                <div className="heatmap-popup-runs">
                  {selectedDayRuns.map((run) => (
                    <button
                      type="button"
                      key={`${run.historyId}-${run.id}`}
                      onClick={() => jumpToRun(run.historyId, run.id)}
                    >
                      <span>
                        <b>{run.gameName}</b>
                        <small>{run.categoryLabel}</small>
                      </span>
                      <strong>{run.time}</strong>
                      <i aria-hidden="true">↓</i>
                    </button>
                  ))}
                </div>
              </section>
            </dialog>
          )}
        </article>

        <article className="overview-card platforms-card">
          <div className="overview-card-heading">
            <span>PLATFORM MIX</span>
            <span>{overview.platforms.length} PLATFORMS</span>
          </div>
          <div className="platform-strip" aria-label="PB distribution by platform">
            {overview.platforms.map(([name, count], index) => (
              <span
                key={name}
                className={`platform-segment tone-${index % 5}`}
                style={{ width: `${(count / overview.platformTotal) * 100}%` }}
                title={`${name}: ${count} PBs`}
              />
            ))}
          </div>
          <div className="platform-legend">
            {overview.platforms.slice(0, 6).map(([name, count], index) => (
              <div key={name}>
                <span className={`legend-dot tone-${index % 5}`} />
                <b>{name}</b>
                <small>{count} PBs</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="overview-feature-grid">
        <article className="overview-card peak-card">
          <div className="overview-card-heading">
            <span>PEAK ACTIVITY</span>
            <span>ARCHIVE PULSE</span>
          </div>
          <div className="peak-body">
            <div className="peak-year">
              <strong>{overview.peakYear?.[0]}</strong>
              <span>{overview.peakYear?.[1]} personal bests</span>
            </div>
            <div className="peak-monthly">
              <div className="peak-monthly-heading">
                <span>MONTHLY RHYTHM</span>
                <span>{overview.peakBreakdown.activeMonths} ACTIVE MONTHS</span>
              </div>
              <div
                className="peak-month-bars"
                role="img"
                aria-label={`Personal bests by month during ${overview.peakYear?.[0]}`}
              >
                {overview.peakBreakdown.months.map((count, index) => (
                  <div
                    className="peak-month"
                    title={`${new Intl.DateTimeFormat("en", {
                      month: "long",
                      timeZone: "UTC",
                    }).format(new Date(Date.UTC(2020, index, 1)))}: ${count} PB${
                      count === 1 ? "" : "s"
                    }`}
                    key={index}
                  >
                    <strong>{count || ""}</strong>
                    <i
                      style={{
                        height: `${Math.max(
                          count ? 7 : 2,
                          (count / overview.peakBreakdown.maxMonth) * 100,
                        )}%`,
                      }}
                    />
                    <small>
                      {
                        [
                          "J",
                          "F",
                          "M",
                          "A",
                          "M",
                          "J",
                          "J",
                          "A",
                          "S",
                          "O",
                          "N",
                          "D",
                        ][index]
                      }
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="peak-facts">
            <div>
              <span>BUSIEST MONTH</span>
              <strong>{overview.peakBreakdown.busiestMonth}</strong>
              <small>
                {overview.peakBreakdown.busiestMonthCount} personal bests
              </small>
            </div>
            <div>
              <span>TOP GAME</span>
              <strong>{overview.peakBreakdown.topGame}</strong>
              <small>{overview.peakBreakdown.topGameCount} milestones</small>
            </div>
            <div>
              <span>BIGGEST LEAP</span>
              <strong>
                −{compactDuration(overview.peakBreakdown.biggestSave.seconds)}
              </strong>
              <small>
                {overview.peakBreakdown.biggestSave.gameName
                  ? `${overview.peakBreakdown.biggestSave.gameName} · ${overview.peakBreakdown.biggestSave.categoryLabel}`
                  : "No prior PB to compare"}
              </small>
            </div>
          </div>
        </article>

        <article className="overview-card achievements-card">
          <div className="overview-card-heading">
            <span>ACHIEVEMENTS</span>
            <span>{overview.achievements.length} UNLOCKED</span>
          </div>
          <div className="achievement-list">
            {overview.achievements.map((achievement, index) => (
              <div className="achievement" key={achievement.name}>
                <span className="achievement-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span>{achievement.name}</span>
                  <strong>{achievement.value}</strong>
                  <small>{achievement.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default function PBHistory({
  data,
  heroVariant = "current",
}: {
  data: SiteData;
  heroVariant?: "current" | "stats-latest";
}) {
  const games = useMemo(() => archiveGames(data.histories), [data.histories]);

  const datedRuns = data.histories
    .flatMap((history) => history.runs)
    .filter((run) => run.date !== "Unknown");
  const earliestYear = Math.min(
    ...datedRuns.map((run) => new Date(`${run.date}T00:00:00Z`).getUTCFullYear()),
  );
  const latestYear = Math.max(
    ...datedRuns.map((run) => new Date(`${run.date}T00:00:00Z`).getUTCFullYear()),
  );
  const yearsTracked = latestYear - earliestYear + 1;
  const totalHours = Math.floor(data.stats.totalRunSeconds / 3600);
  const totalMinutes = Math.floor((data.stats.totalRunSeconds % 3600) / 60);
  const profileAvatar = data.profile.avatar;
  const heroTitleMode =
    data.profile.name.length <= 6
      ? "short"
      : data.profile.name.length <= 14
        ? "medium"
        : "long";
  const datedEntries = useMemo(
    () =>
      data.histories
        .flatMap((history) =>
          history.runs.map((run, index) => ({
            history,
            run,
            previous: index > 0 ? history.runs[index - 1] : null,
          })),
        )
        .filter(({ run }) => run.date !== "Unknown")
        .sort((a, b) => b.run.date.localeCompare(a.run.date)),
    [data.histories],
  );
  const timelineEntries = useMemo(
    () => [...datedEntries].reverse(),
    [datedEntries],
  );
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState(() =>
    Math.max(0, timelineEntries.length - 1),
  );
  const [settledTimelineIndex, setSettledTimelineIndex] = useState(() =>
    Math.max(0, timelineEntries.length - 1),
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setSettledTimelineIndex(selectedTimelineIndex),
      180,
    );
    return () => window.clearTimeout(timeout);
  }, [selectedTimelineIndex]);

  const timelineYears = Array.from(
    { length: yearsTracked },
    (_, index) => earliestYear + index,
  );
  const timelineEvents = useMemo(() => {
    const totalsByYear = new Map<number, number>();
    const seenByYear = new Map<number, number>();

    timelineEntries.forEach(({ run }) => {
      const year = new Date(`${run.date}T00:00:00Z`).getUTCFullYear();
      totalsByYear.set(year, (totalsByYear.get(year) ?? 0) + 1);
    });

    return timelineEntries.map((entry, index) => {
      const year = new Date(`${entry.run.date}T00:00:00Z`).getUTCFullYear();
      const ordinal = seenByYear.get(year) ?? 0;
      const totalInYear = totalsByYear.get(year) ?? 1;
      seenByYear.set(year, ordinal + 1);

      return {
        entry,
        index,
        position:
          ((year - earliestYear + (ordinal + 1) / (totalInYear + 1)) /
            yearsTracked) *
          100,
      };
    });
  }, [earliestYear, timelineEntries, yearsTracked]);
  const selectedEvent =
    timelineEvents[selectedTimelineIndex] ?? timelineEvents.at(-1);
  const selectedEntry = selectedEvent?.entry ?? datedEntries[0];
  const settledEntry =
    timelineEntries[settledTimelineIndex] ?? selectedEntry;
  const selectedVideo = settledEntry
    ? embedUrl(settledEntry.run.video)
    : null;
  const selectedImprovement = selectedEntry?.previous
    ? selectedEntry.previous.seconds - selectedEntry.run.seconds
    : null;
  const selectedImprovementLabel =
    selectedImprovement === null
      ? "First PB"
      : compactPreciseDuration(selectedImprovement);
  const daysSincePrevious = selectedEntry?.previous
    ? Math.max(
        0,
        Math.round(
          (Date.parse(`${selectedEntry.run.date}T00:00:00Z`) -
            Date.parse(`${selectedEntry.previous.date}T00:00:00Z`)) /
            86_400_000,
        ),
      )
    : null;
  const isLatestSelection =
    selectedTimelineIndex === timelineEntries.length - 1;
  const selectedCategory = selectedEntry
    ? [
        selectedEntry.history.categoryName,
        selectedEntry.history.levelName,
        selectedEntry.history.variant,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <main id="top" style={archiveStyle(data.profile)}>
      <ArchiveNavigator games={games} />
      <UserHeader profile={data.profile} />

      <section
        className={`hero${heroVariant === "stats-latest" ? " hero-stats-latest" : ""}`}
      >
        <div className="hero-intro">
          <div className="hero-profile">
            {profileAvatar ? (
              <img src={profileAvatar} alt="" width="64" height="64" />
            ) : (
              <span className="hero-avatar-fallback" aria-hidden="true">
                {data.profile.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>
              <b className="accent-name">@{data.profile.name}</b>
              <small>{data.profile.country} · speedrunning since {earliestYear}</small>
            </span>
          </div>

          <div className="hero-core">
            <h1 className={`hero-title-${heroTitleMode}`}>
              <span className="accent-name">{data.profile.name}’s</span>{" "}
              {heroTitleMode === "long" && <br />}
              Sum of Best
            </h1>
            {heroVariant === "stats-latest" ? (
              <>
                <div className="hero-summary" aria-label="Archive totals">
                  <p>
                    <strong>{data.stats.games} games</strong>,{" "}
                    <strong>{data.stats.histories} categories</strong>, and{" "}
                    <strong>{data.stats.pbRuns} PBs</strong> collected over{" "}
                    <strong>
                      {yearsTracked} {yearsTracked === 1 ? "year" : "years"}
                    </strong>
                    .
                  </p>
                  <p>
                    That adds up to {totalHours} {totalHours === 1 ? "hour" : "hours"}
                    {" "}and {totalMinutes}{" "}
                    {totalMinutes === 1 ? "minute" : "minutes"} of finished runs
                    across {data.stats.platforms}{" "}
                    {data.stats.platforms === 1 ? "platform" : "platforms"}.
                  </p>
                </div>
                {selectedEntry && selectedEvent ? (
                  <div className="hero-career-timeline">
                    <div className="hero-career-timeline-heading">
                      <span>CAREER TIMELINE</span>
                      <span>{displayDate(selectedEntry.run.date)}</span>
                    </div>
                    <div
                      className="hero-career-years"
                      style={{
                        gridTemplateColumns: `repeat(${timelineYears.length}, minmax(0, 1fr))`,
                      }}
                      aria-hidden="true"
                    >
                      {timelineYears.map((year) => (
                        <span key={year}>{year}</span>
                      ))}
                    </div>
                    <div className="hero-career-track">
                      <span className="hero-career-line" aria-hidden="true" />
                      <span
                        className="hero-career-progress"
                        style={{ width: `${selectedEvent.position}%` }}
                        aria-hidden="true"
                      />
                      <div className="hero-career-ticks" aria-hidden="true">
                        {timelineEvents.map((timelineEvent) => (
                          <span
                            key={timelineEvent.entry.run.id}
                            style={{ left: `${timelineEvent.position}%` }}
                          />
                        ))}
                      </div>
                      <span
                        className="hero-career-playhead"
                        style={{ left: `${selectedEvent.position}%` }}
                        aria-hidden="true"
                      />
                      <input
                        className="hero-career-range"
                        type="range"
                        min="0"
                        max="1000"
                        value={Math.round(selectedEvent.position * 10)}
                        aria-label="Browse personal best history"
                        aria-valuetext={`${displayDate(selectedEntry.run.date)}, ${selectedEntry.history.gameName}, ${selectedCategory}`}
                        onChange={(event) => {
                          const position = Number(event.currentTarget.value) / 10;
                          const nearest = timelineEvents.reduce((best, item) =>
                            Math.abs(item.position - position) <
                            Math.abs(best.position - position)
                              ? item
                              : best,
                          );
                          setSelectedTimelineIndex(nearest.index);
                        }}
                        onKeyDown={(event) => {
                          const direction =
                            event.key === "ArrowLeft" || event.key === "ArrowDown"
                              ? -1
                              : event.key === "ArrowRight" || event.key === "ArrowUp"
                                ? 1
                                : 0;
                          if (direction) {
                            event.preventDefault();
                            setSelectedTimelineIndex((index) =>
                              Math.max(
                                0,
                                Math.min(timelineEntries.length - 1, index + direction),
                              ),
                            );
                          } else if (event.key === "Home" || event.key === "End") {
                            event.preventDefault();
                            setSelectedTimelineIndex(
                              event.key === "Home" ? 0 : timelineEntries.length - 1,
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="hero-lede">
                  A complete history of {data.profile.name}’s speedruns.
                  Current records, obsolete PBs, and every improvement in between.
                </p>
                <p>
                  Choose a game to explore the timeline and watch the available runs.
                </p>
              </>
            )}
          </div>
          <a className="primary-link" href="#games">
            EXPLORE THE RUNS <span>↓</span>
          </a>
        </div>

        {heroVariant === "stats-latest" && selectedEntry ? (
          <aside
            className="hero-latest"
            aria-label={isLatestSelection ? "Latest personal best" : "Selected personal best"}
          >
            <div className="video-topline">
              <span>{isLatestSelection ? "LATEST PB" : "ARCHIVE PB"}</span>
              <span>{displayDate(selectedEntry.run.date)}</span>
            </div>
            <div className="hero-latest-copy">
              <h2 title={selectedEntry.history.gameName}>
                {selectedEntry.history.gameName}
              </h2>
              <p title={selectedCategory}>{selectedCategory}</p>
              <dl className="hero-latest-primary">
                <div>
                  <dt>Time</dt>
                  <dd>{selectedEntry.run.time}</dd>
                </div>
                <div>
                  <dt>Time saved</dt>
                  <dd>{selectedImprovementLabel}</dd>
                </div>
              </dl>
              <dl className="hero-latest-meta">
                <div>
                  <dt>Previous PB</dt>
                  <dd>{selectedEntry.previous?.time ?? "-"}</dd>
                </div>
                <div>
                  <dt>Since previous</dt>
                  <dd>
                    {daysSincePrevious === null
                      ? "-"
                      : `${daysSincePrevious} ${daysSincePrevious === 1 ? "day" : "days"}`}
                  </dd>
                </div>
                <div>
                  <dt>Category PBs</dt>
                  <dd>{selectedEntry.history.runs.length}</dd>
                </div>
              </dl>
            </div>
            <div className="video-frame">
              {selectedVideo ? (
                <iframe
                  src={selectedVideo}
                  title={`${settledEntry.history.gameName} ${settledEntry.history.categoryName} in ${settledEntry.run.time}`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="video-fallback">
                  <p>No embeddable video for this run.</p>
                </div>
              )}
            </div>
            <a
              className="hero-latest-action"
              href={selectedEntry.run.runUrl}
              target="_blank"
              rel="noreferrer"
            >
              WATCH RUN <span>↗</span>
            </a>
          </aside>
        ) : (
          <aside className="hero-note" aria-label="A note about the archive">
            <span className="note-label">ARCHIVE AT A GLANCE</span>
            <p>
              <strong>{data.stats.games} games</strong>,{" "}
              <strong>{data.stats.histories} categories</strong>, and{" "}
              <strong>{data.stats.pbRuns} PBs</strong> collected over{" "}
              <strong>{yearsTracked} years</strong>.
            </p>
            <p>
              That adds up to {totalHours} hours and {totalMinutes} minutes of
              finished runs across {data.stats.platforms} platforms.
            </p>
          </aside>
        )}
      </section>

      <ArchiveOverview histories={data.histories} />

      <section className="game-index" id="games" data-archive-id="games">
        <div className="section-label">
          <span>02</span>
          <h2>GAME INDEX</h2>
          <span>{String(games.length).padStart(2, "0")} TITLES</span>
        </div>
        <div className="game-links">
          {games.map((game, index) => (
            <a href={`#${game.id}`} key={game.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {game.name}
              <b>{game.displayCount}</b>
            </a>
          ))}
        </div>
      </section>

      <div className="games">
        {games.map((game, gameIndex) => {
          const groupedLevels = game.histories.filter(
            (history) => history.levelName,
          );
          const standaloneHistories = groupedLevels.length
            ? game.histories.filter((history) => !history.levelName)
            : game.histories;

          return (
            <section className="game-section" id={game.id} key={game.id}>
            <GameHeading game={game} index={gameIndex} />
            <div className="game-histories">
              {standaloneHistories.map((history, index) => (
                <HistoryBlock
                  history={history}
                  index={index}
                  username={data.profile.name}
                  key={history.id}
                />
              ))}
              {groupedLevels.length > 0 && (
                <LevelCollection
                  histories={groupedLevels}
                  username={data.profile.name}
                />
              )}
            </div>
          </section>
          );
        })}
      </div>

      <footer className="archive-footer">
        <span>SUM OF BEST / ARCHIVE</span>
        <p>
          {data.source === "demo"
            ? "Fictional runner and sample run data"
            : "Data sourced from speedrun.com · Includes verified obsolete runs"}
          {" · "}Updated {displayDate(data.generatedAt.slice(0, 10))}
        </p>
        <a href="#top">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}
