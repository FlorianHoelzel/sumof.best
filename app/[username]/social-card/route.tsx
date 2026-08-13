import { ImageResponse } from "next/og";
import arimoBoldFontDataUrl from "../../../public/fonts/arimo-bold.ttf?inline";
import speedrunData from "../../data/speedruns.json";
import { getUserArchive } from "../../archive-cache";

const arimoBoldFont = fetch(arimoBoldFontDataUrl).then((response) =>
  response.arrayBuffer(),
);

function safeAccent(value: string | null | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#c8c7c2";
}

function encodeBase64(bytes: Uint8Array) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    encoded += alphabet[(chunk >> 18) & 63];
    encoded += alphabet[(chunk >> 12) & 63];
    encoded += second === undefined ? "=" : alphabet[(chunk >> 6) & 63];
    encoded += third === undefined ? "=" : alphabet[chunk & 63];
  }

  return encoded;
}

async function shareCardCover(source: string | null | undefined) {
  if (!source) return null;

  try {
    const url = new URL(source);

    if (url.protocol !== "https:" || url.hostname !== "www.speedrun.com") {
      return null;
    }

    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url.toString())}&w=188&h=252&fit=cover&output=png`;
    const response = await fetch(proxyUrl, {
      headers: {
        Accept: "image/png,image/*;q=0.8",
        "User-Agent": "sumof.best social card",
      },
    });

    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    return `data:${response.headers.get("content-type") ?? "image/png"};base64,${encodeBase64(bytes)}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);
  const data =
    decodedUsername.toLowerCase() === speedrunData.profile.name.toLowerCase()
      ? speedrunData
      : await getUserArchive(decodedUsername);

  if (!data) return new Response("Archive not found", { status: 404 });

  const name = data.profile.name;
  const requestedHistory = new URL(request.url).searchParams.get("history");
  const sharedHistory = requestedHistory
    ? data.histories.find((history) => history.id === requestedHistory)
    : undefined;
  const sharedCategory = sharedHistory
    ? [sharedHistory.categoryName, sharedHistory.levelName, sharedHistory.variant]
        .filter(Boolean)
        .join(" / ")
    : "";
  const sharedCurrent = sharedHistory?.runs.at(-1);
  const sharedFirst = sharedHistory?.runs[0];
  const sharedGameFontSize = !sharedHistory
    ? 68
    : sharedHistory.gameName.length > 38
      ? 46
      : sharedHistory.gameName.length > 24
        ? 56
        : 70;
  const sharedCover = await shareCardCover(sharedHistory?.gameCover);
  const accent = safeAccent(data.profile.nameColor?.from);
  const years = data.histories
    .flatMap((history) => history.runs)
    .map((run) => run.date.slice(0, 4))
    .filter((year) => /^\d{4}$/.test(year))
    .map(Number);
  const yearRange = years.length
    ? `${Math.min(...years)} / ${Math.max(...years)}`
    : "ARCHIVE READY";
  const sharedYears = sharedHistory?.runs
    .map((run) => Number(run.date.slice(0, 4)))
    .filter(Number.isFinite);
  const displayYearRange = sharedYears?.length
    ? `${Math.min(...sharedYears)} / ${Math.max(...sharedYears)}`
    : yearRange;
  const chartWidth = 610;
  const chartHeight = 108;
  const chartPadding = 7;
  const chartRuns = sharedHistory?.runs ?? [];
  const chartValues = chartRuns.map((run) => run.seconds);
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length ? Math.max(...chartValues) : 1;
  const chartSpan = Math.max(chartMax - chartMin, 1);
  const chartPoints = chartRuns.map((run, index) => ({
    x:
      chartRuns.length === 1
        ? chartWidth / 2
        : chartPadding +
          (index / (chartRuns.length - 1)) * (chartWidth - chartPadding * 2),
    y:
      chartRuns.length === 1
        ? chartHeight / 2
        : chartPadding +
          ((chartMax - run.seconds) / chartSpan) *
            (chartHeight - chartPadding * 2),
  }));
  const chartPath = chartPoints
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const gridColumns = Array.from({ length: 32 }, (_, index) => index * 38);
  const gridRows = Array.from({ length: 17 }, (_, index) => index * 38);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0e0e0e",
          color: "#f1f0ec",
          fontFamily: "Arimo",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
          }}
        >
          {gridColumns.map((left) => (
            <div
              key={`column-${left}`}
              style={{
                position: "absolute",
                left,
                top: 0,
                width: 1,
                height: 630,
                background: "rgba(255,255,255,0.018)",
              }}
            />
          ))}
          {gridRows.map((top) => (
            <div
              key={`row-${top}`}
              style={{
                position: "absolute",
                left: 0,
                top,
                width: 1200,
                height: 1,
                background: "rgba(255,255,255,0.018)",
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            height: 8,
            width: "100%",
            background: accent,
          }}
        />

        <header
          style={{
            height: 82,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 54px",
            borderBottom: "1px solid #444440",
            background: "rgba(14,14,14,0.88)",
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.16em" }}>
            SUM OF BEST
          </span>
          <span
            style={{
              color: "#9d9d99",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.13em",
            }}
          >
            {sharedHistory ? "SHAREABLE GAME PB CARD" : "SPEEDRUN.COM PB ARCHIVE"}
          </span>
        </header>

        <main style={{ display: "flex", flex: 1, padding: "40px 54px 34px" }}>
          {sharedHistory && sharedCurrent ? (
            <>
              <section
                style={{
                  width: 742,
                  display: "flex",
                  flexDirection: "column",
                  paddingRight: 48,
                  borderRight: "1px solid #444440",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    color: accent,
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                  }}
                >
                  <span>@{name.toUpperCase()}</span>
                  <span style={{ color: "#666660" }}>/</span>
                  <span>GAME PB HISTORY</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginTop: 20,
                    width: 610,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      maxWidth: sharedCover ? 460 : 610,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        fontSize: sharedGameFontSize,
                        fontWeight: 700,
                        letterSpacing: "-0.045em",
                        lineHeight: 0.94,
                      }}
                    >
                      {sharedHistory.gameName}
                    </div>

                    <span
                      style={{
                        color: accent,
                        fontSize: 27,
                        fontWeight: 700,
                        letterSpacing: "-0.025em",
                        lineHeight: 1.12,
                        marginTop: 18,
                      }}
                    >
                      {sharedCategory}
                    </span>
                  </div>

                  {sharedCover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sharedCover}
                      alt=""
                      width={94}
                      height={126}
                      style={{
                        border: `2px solid ${accent}`,
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: 610,
                    marginTop: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#9d9d99",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.11em",
                      marginBottom: 8,
                    }}
                  >
                    <span>PB PROGRESSION</span>
                    <span>{chartRuns.length} VERIFIED PB{chartRuns.length === 1 ? "" : "S"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: chartHeight,
                      width: chartWidth,
                      borderTop: "1px solid #444440",
                      borderBottom: "1px solid #444440",
                      position: "relative",
                    }}
                  >
                    <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                      {chartPath && (
                        <path
                          d={chartPath}
                          fill="none"
                          stroke={accent}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {chartPoints.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r={index === chartPoints.length - 1 ? 6 : 4}
                          fill={index === chartPoints.length - 1 ? accent : "#0e0e0e"}
                          stroke={accent}
                          strokeWidth="3"
                        />
                      ))}
                    </svg>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#9d9d99",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      marginTop: 8,
                    }}
                  >
                    <span>{sharedFirst?.date.slice(0, 10)}</span>
                    <span>{sharedCurrent.date.slice(0, 10)}</span>
                  </div>
                </div>
              </section>

              <aside
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  paddingLeft: 42,
                }}
              >
                <span
                  style={{
                    color: "#9d9d99",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.13em",
                  }}
                >
                  CURRENT PERSONAL BEST
                </span>
                <strong
                  style={{
                    color: accent,
                    fontSize: sharedCurrent.time.length > 9 ? 47 : 58,
                    letterSpacing: "-0.045em",
                    lineHeight: 1,
                    margin: "13px 0 25px",
                  }}
                >
                  {sharedCurrent.time}
                </strong>

                {[
                  [sharedHistory.runs.length, "PB MILESTONES"],
                  [sharedCurrent.date.slice(0, 10), "CURRENT PB DATE"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderTop: "1px solid #444440",
                      padding: "10px 0 9px",
                    }}
                  >
                    <span
                      style={{
                        color: "#9d9d99",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        color: "#f1f0ec",
                        fontSize: 20,
                        fontWeight: 700,
                        marginTop: 3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </aside>
            </>
          ) : (
            <>
          <section
            style={{
              width: 742,
              display: "flex",
              flexDirection: "column",
              paddingRight: 48,
              borderRight: "1px solid #444440",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: accent,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              <span>01</span>
              <span style={{ color: "#666660" }}>/</span>
              <span>@{name.toUpperCase()}</span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 30,
                fontSize: 86,
                fontWeight: 700,
                letterSpacing: "-0.055em",
                lineHeight: 0.88,
              }}
            >
              <span>PERSONAL BEST</span>
              <span style={{ color: accent }}>HISTORY</span>
            </div>

            <span
              style={{
                width: 610,
                marginTop: 32,
                color: "#b6b5b0",
                fontSize: 21,
                lineHeight: 1.35,
              }}
            >
              Current records, obsolete PBs, and every improvement in between.
            </span>
          </section>

          <aside
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              paddingLeft: 42,
            }}
          >
            <span
              style={{
                color: "#9d9d99",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.13em",
                marginBottom: 18,
              }}
            >
              ARCHIVE AT A GLANCE
            </span>

            {[
              [data.stats.pbRuns, "PB MILESTONES"],
              [data.stats.games, "GAMES"],
              [data.stats.histories, "CATEGORIES"],
            ].map(([value, label]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  borderTop: "1px solid #444440",
                  padding: "15px 0 13px",
                }}
              >
                <span style={{ color: accent, fontSize: 38, fontWeight: 700 }}>
                  {value}
                </span>
                <span
                  style={{
                    color: "#b6b5b0",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </aside>
            </>
          )}
        </main>

        <footer
          style={{
            height: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 54px",
            borderTop: "1px solid #444440",
            background: "rgba(14,14,14,0.9)",
            color: "#9d9d99",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.11em",
          }}
        >
          <span>{displayYearRange}</span>
          <span style={{ color: accent }}>SUMOF.BEST/{name.toUpperCase()}</span>
        </footer>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Arimo",
          data: await arimoBoldFont,
          weight: 700,
          style: "normal",
        },
      ],
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );

  // Materialize the lazy ImageResponse body before returning so renderer
  // failures become normal route errors instead of dropped HTTP connections.
  const png = await image.arrayBuffer();

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
