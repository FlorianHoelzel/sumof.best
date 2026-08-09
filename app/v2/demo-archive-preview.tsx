import Image from "next/image";
import { archiveStyle, displayDate } from "../archive-view";
import type { SiteData } from "../pb-history";

export default function DemoArchivePreview({ data }: { data: SiteData }) {
  const history = data.histories[0];
  const allEntries = data.histories
    .flatMap((item) => item.runs.map((run) => ({ history: item, run })))
    .sort((a, b) => a.run.date.localeCompare(b.run.date));
  const latest = allEntries.at(-1)!;
  const firstYear = allEntries[0].run.date.slice(0, 4);
  const lastYear = latest.run.date.slice(0, 4);
  const activeYears = Number(lastYear) - Number(firstYear) + 1;
  const topGames = [
    ["Celeste", 4],
    ["Super Mario 64", 3],
    ["Portal", 3],
  ] as const;
  const peakMonths = [0, 1, 0, 2, 0, 1, 0, 0, 2, 0, 0, 0];

  return (
    <section
      className="v2-demo-showcase"
      id="archive-preview"
      aria-label="Cropped example of a Sum of Best archive"
      style={archiveStyle(data.profile)}
    >
      <div className="v2-demo-window" inert>
        <header className="v2-demo-window-header">
          <span>SUM OF BEST / <b>{data.profile.name.toUpperCase()}</b></span>
          <nav aria-hidden="true">
            <span>OVERVIEW</span>
            <span>THE RUNS</span>
            <span>DEMO DATA</span>
          </nav>
        </header>

        <div className="v2-demo-hero-crop">
          <div className="v2-demo-hero-main">
            <div className="v2-demo-profile">
              <span aria-hidden="true">D</span>
              <div>
                <strong>@{data.profile.name}</strong>
                <small>DEMO DATA · SPEEDRUNNING SINCE {firstYear}</small>
              </div>
            </div>

            <h2><em>{data.profile.name}&apos;s</em> Sum of Best</h2>

            <dl className="v2-demo-stats">
              <div><dt>PBs</dt><dd>{data.stats.pbRuns}</dd></div>
              <div><dt>Games</dt><dd>{data.stats.games}</dd></div>
              <div><dt>Categories</dt><dd>{data.stats.histories}</dd></div>
              <div><dt>Active years</dt><dd>{activeYears}</dd></div>
            </dl>

            <div className="v2-demo-career">
              <div className="v2-demo-career-heading">
                <span>CAREER TIMELINE</span>
                <span>{displayDate(latest.run.date)}</span>
              </div>
              <div className="v2-demo-years">
                <span>{firstYear}</span>
                <span>{lastYear}</span>
              </div>
              <div className="v2-demo-track" aria-hidden="true">
                <span className="v2-demo-track-progress" />
                {allEntries.map((entry, index) => (
                  <i
                    className={index === allEntries.length - 1 ? "is-current" : ""}
                    key={entry.run.id}
                    style={{ left: `${(index / (allEntries.length - 1)) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <aside className="v2-demo-latest">
            <div className="v2-demo-latest-topline">
              <span>LATEST PB</span>
              <span>{displayDate(latest.run.date)}</span>
            </div>
            <div className="v2-demo-latest-cover">
              {latest.history.gameCover && (
                <Image
                  src={latest.history.gameCover}
                  alt=""
                  width={520}
                  height={220}
                  unoptimized
                />
              )}
            </div>
            <div className="v2-demo-latest-copy">
              <h3>{latest.history.gameName}</h3>
              <p>{latest.history.categoryName} · {latest.history.variant}</p>
              <dl>
                <div><dt>Time</dt><dd>{latest.run.time}</dd></div>
                <div><dt>Category PBs</dt><dd>{latest.history.runs.length}</dd></div>
              </dl>
            </div>
          </aside>
        </div>

        <div className="v2-demo-overview-crop">
          <article className="overview-card top-games-card">
            <div className="overview-card-heading">
              <span>TOP GAMES</span>
              <span>BY PB MILESTONES</span>
            </div>
            <div className="ranked-games">
              {topGames.map(([name, count], index) => (
                <a href="#" key={name} tabIndex={-1}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <b>{name}</b>
                    <i style={{ width: `${(count / 4) * 100}%` }} />
                  </div>
                  <strong>{count}</strong>
                </a>
              ))}
            </div>
          </article>

          <article className="overview-card peak-card">
            <div className="overview-card-heading">
              <span>PEAK ACTIVITY</span>
              <span>ARCHIVE PULSE</span>
            </div>
            <div className="peak-body">
              <div className="peak-year">
                <strong>2024</strong>
                <span>6 personal bests</span>
              </div>
              <div className="peak-monthly">
                <div className="peak-monthly-heading">
                  <span>MONTHLY RHYTHM</span>
                  <span>4 ACTIVE MONTHS</span>
                </div>
                <div className="peak-month-bars" aria-hidden="true">
                  {peakMonths.map((count, index) => (
                    <div className="peak-month" key={index}>
                      <strong>{count || ""}</strong>
                      <i style={{ height: `${count ? count * 50 : 2}%` }} />
                      <small>{"JFMAMJJASOND"[index]}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="peak-facts">
              <div><span>BUSIEST MONTH</span><strong>April</strong><small>2 personal bests</small></div>
              <div><span>TOP GAME</span><strong>Celeste</strong><small>4 milestones</small></div>
              <div><span>BIGGEST LEAP</span><strong>−6m 10s</strong><small>Celeste · Any%</small></div>
            </div>
          </article>
        </div>

        <div className="v2-demo-graph-crop">
          <div className="v2-demo-graph-heading">
            <span>
              <small>FULL GAME / {history.categoryName}</small>
              <strong>{history.gameName}</strong>
            </span>
            <span>{history.runs.length} PBs · LRT</span>
          </div>
          <div className="v2-demo-graph-layout">
            <div className="chart-wrap">
              <div className="chart-labels">
                <span>PB PROGRESSION</span>
                <span>TIME</span>
              </div>
              <div className="chart-stage">
                <svg
                  className="chart"
                  viewBox="0 0 520 180"
                  role="img"
                  aria-label="Four fictional Celeste personal bests improving over time"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <line className="axis" x1="18" y1="24" x2="18" y2="154" />
                  <line className="axis" x1="18" y1="154" x2="502" y2="154" />
                  <line className="v2-demo-gridline" x1="18" y1="67" x2="502" y2="67" />
                  <line className="v2-demo-gridline" x1="18" y1="110" x2="502" y2="110" />
                  <polyline
                    className="chart-line"
                    points="18,34 178,76 338,116 502,146"
                  />
                  {[
                    [18, 34],
                    [178, 76],
                    [338, 116],
                    [502, 146],
                  ].map(([x, y], index) => (
                    <circle
                      className={`chart-dot${index === 3 ? " active" : ""}`}
                      cx={x}
                      cy={y}
                      key={history.runs[index].id}
                      r="5"
                    />
                  ))}
                </svg>
              </div>
              <div className="chart-range">
                <span>{displayDate(history.runs[0].date)}</span>
                <span>{displayDate(history.runs.at(-1)!.date)}</span>
              </div>
            </div>

            <section className="runs-panel">
              <div className="table-heading">
                <span>PB HISTORY</span>
                <span>4 RUNS</span>
              </div>
              <div className="run-list">
                {history.runs
                  .map((run, index) => ({ run, index }))
                  .reverse()
                  .map(({ run, index }) => (
                    <button
                      className={`run-row${run.current ? " active" : ""}`}
                      key={run.id}
                      type="button"
                      tabIndex={-1}
                    >
                      <span className="row-dot" />
                      <span className="row-date">
                        <span>{displayDate(run.date)}</span>
                        <small>RUN {String(index + 1).padStart(2, "0")}</small>
                      </span>
                      <strong>{run.time}</strong>
                      <span className="row-action">PB</span>
                    </button>
                  ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
