import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Sum of Best landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Sum of Best/i);
  assert.match(html, /Your personal PB Archive/i);
  assert.match(html, /Check out a demo archive/i);
  assert.match(html, /"@type":"WebApplication"/i);
  assert.match(
    html,
    /<script[^>]+src="https:\/\/stats\.sumof\.best\/script\.js"[^>]+data-website-id="b586f22e-d4e3-4a55-9154-c9f44325a61c"/i,
  );
  assert.match(
    html,
    /<meta name="google-site-verification" content="JeLkuzRbmBwi5uiI3t9g6JZV1r75RKrejPkG7kxkiy0"/i,
  );
  assert.doesNotMatch(html, /Your site is taking shape/i);
});

test("serves search-engine discovery files", async () => {
  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  const robotsText = await robots.text();
  assert.match(robotsText, /^User-Agent: \*$/m);
  assert.match(robotsText, /^Disallow: \/api\/$/m);
  assert.match(robotsText, /^Sitemap: https:\/\/sumof\.best\/sitemap\.xml$/m);

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const sitemapXml = await sitemap.text();
  assert.match(sitemapXml, /<loc>https:\/\/sumof\.best<\/loc>/);
  assert.match(sitemapXml, /<loc>https:\/\/sumof\.best\/Volpey<\/loc>/);
  assert.doesNotMatch(sitemapXml, /\/explore<\/loc>/);
  assert.doesNotMatch(sitemapXml, /<lastmod>/);

  const directory = await render("/explore");
  assert.equal(directory.status, 404);
});

test("keeps the required public assets", async () => {
  await Promise.all([
    access(new URL("public/favicon.svg", projectRoot)),
    access(new URL("public/fonts/arimo-variable.ttf", projectRoot)),
    access(new URL("public/fonts/arimo-bold.ttf", projectRoot)),
    access(new URL("public/fonts/OFL.txt", projectRoot)),
  ]);
});

test("server-renders shareable PB feed routes", async () => {
  const feed = await render("/volpey/feed");
  assert.equal(feed.status, 200);
  const feedHtml = await feed.text();
  assert.match(feedHtml, /PB FEED/i);
  assert.match(feedHtml, /<link rel="canonical" href="https:\/\/sumof\.best\/volpey\/feed"/i);
  const feedTitle = feedHtml.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
  assert.equal(feedTitle.match(/Sum of Best/gi)?.length, 1);
  assert.match(
    feedHtml,
    /class="brand-avatar"[^>]+src="https:\/\/www\.speedrun\.com\/static\/user\//,
  );
  assert.match(feedHtml, /href="\/">SUM OF BEST<\/a>/);
  assert.match(
    feedHtml,
    /class="accent-name" href="\/volpey">VOLPEY<\/a>/i,
  );
  assert.match(feedHtml, /href="\/volpey#overview">OVERVIEW<\/a>/i);
  assert.match(feedHtml, /href="\/volpey#games">THE RUNS<\/a>/i);
  assert.match(feedHtml, /href="\/volpey\/feed">PB FEED<\/a>/i);
  assert.match(feedHtml, /href="\/volpey\/passport">PASSPORT<\/a>/i);
  assert.match(
    feedHtml,
    /class="accent-name" href="\/volpey">VOLPEY<\/a><span aria-hidden="true">\/<\/span><a href="\/volpey\/feed">PB FEED<\/a>/i,
  );
  assert.match(
    feedHtml,
    /href="\/volpey\/feed">PB FEED<\/a><a href="\/volpey\/passport">PASSPORT<\/a>/i,
  );
  const feedHeader = feedHtml.match(/<header class="site-header">.*?<\/header>/i)?.[0];
  assert.ok(feedHeader);
  assert.doesNotMatch(feedHeader, /<button/i);
  assert.match(feedHtml, /<section class="feed-hero">.*?aria-label="Feed actions"/i);
  assert.doesNotMatch(feedHtml, /FIRST PB IMPROVEMENT/i);

  const embed = await render("/volpey/embed/feed");
  assert.equal(embed.status, 200);
  const embedHtml = await embed.text();
  assert.match(embedHtml, /RECENT PERSONAL BESTS/i);
  assert.match(embedHtml, /name="robots" content="noindex, follow"/i);
});

test("serves the public Twitch PB feed API with CORS", async () => {
  const response = await render("/api/feed?username=volpey");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/);

  const feed = await response.json();
  assert.equal(feed.profile.name.toLowerCase(), "volpey");
  assert.match(feed.profile.archiveUrl, /^https:\/\/sumof\.best\/volpey$/i);
  assert.ok(feed.totalPbs > 0);
  assert.ok(feed.items.length > 0 && feed.items.length <= 12);
  assert.ok(feed.items.every((item) => item.archiveUrl.startsWith(feed.profile.archiveUrl)));

  const categoriesResponse = await render("/api/feed?username=volpey&view=categories");
  assert.equal(categoriesResponse.status, 200);
  const categories = await categoriesResponse.json();
  assert.ok(categories.categories.length > 0);
  assert.ok(categories.categories.every((category) => category.id && category.pbCount > 0));

  const selectedCategory = categories.categories[0];
  const historyResponse = await render(
    `/api/feed?username=volpey&history=${encodeURIComponent(selectedCategory.id)}`,
  );
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.equal(history.history.id, selectedCategory.id);
  assert.ok(history.history.runs.length > 0);
  assert.match(history.history.embedUrl, /^https:\/\/sumof\.best\/volpey\/embed\//i);
});

test("server-renders the archive overview", async () => {
  const response = await render("/volpey");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Volpey[^<]+speedrun PB history[^<]+Sum of Best<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/sumof\.best\/Volpey"/i);
  assert.match(
    html,
    /property="og:image" content="https:\/\/sumof\.best\/Volpey\/social-card"/i,
  );
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.match(html, /"@type":"ProfilePage"/i);
  assert.match(html, /href="\/">SUM OF BEST<\/a>/);
  assert.match(html, /class="accent-name" href="\/volpey">VOLPEY<\/a>/i);
  assert.match(html, /href="\/volpey\/passport"/i);
  assert.match(html, /LATEST PB/i);
  assert.match(html, /aria-label="Archive totals"/i);
  assert.match(html, /aria-label="Latest personal best"/i);
  assert.doesNotMatch(html, /ARCHIVE AT A GLANCE/i);
  assert.match(html, /<h2>GAME INDEX<\/h2>/i);
  assert.match(html, /\d{2}(?:<!-- -->)? TITLES/);
  assert.doesNotMatch(html, /PB STAMPS/);
  assert.doesNotMatch(html, /World records when set/i);
  assert.doesNotMatch(html, /HISTORIC WRS/i);

  const socialCard = await render("/Volpey/social-card");
  assert.equal(socialCard.status, 200);
  assert.match(socialCard.headers.get("content-type") ?? "", /^image\/png\b/i);
  assert.match(socialCard.headers.get("cache-control") ?? "", /s-maxage=86400/i);
  assert.ok((await socialCard.arrayBuffer()).byteLength > 10_000);
});

test("keeps the fictional demo runner out of search results", async () => {
  const response = await render("/demo_runner");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /name="robots" content="noindex, nofollow"/i);
});

test("serves a fresh generated archive from the durable cache", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sumof-best-cache-"));
  const username = "cached-runner";
  const key = createHash("sha256").update(username).digest("hex");
  const data = JSON.parse(
    await readFile(new URL("../app/data/speedruns.json", import.meta.url), "utf8"),
  );
  const now = Date.now();

  await writeFile(
    path.join(directory, `${key}.json`),
    JSON.stringify({
      version: 4,
      key,
      storedAt: new Date(now).toISOString(),
      refreshAfter: new Date(now + 60_000).toISOString(),
      expiresAt: new Date(now + 120_000).toISOString(),
      data,
    }),
  );

  process.env.ARCHIVE_CACHE_DIR = directory;
  try {
    const response = await render(`/${username}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Volpey(?:&apos;|&#x27;|â€™)s Sum of Best/i);
  } finally {
    delete process.env.ARCHIVE_CACHE_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});

test("builds an uncached archive without per-resource or leaderboard requests", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sumof-best-live-build-"));
  const originalFetch = globalThis.fetch;
  const requestedPaths = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== "https://www.speedrun.com") {
      return originalFetch(input, init);
    }

    requestedPaths.push(`${url.pathname}${url.search}`);
    const json = (data) =>
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });

    if (url.pathname === "/api/v1/users") {
      return json({
        data: [{
          id: "user-1",
          names: { international: "MockRunner" },
          weblink: "https://www.speedrun.com/users/MockRunner",
          location: null,
          assets: {},
        }],
      });
    }

    if (url.pathname === "/api/v1/runs") {
      assert.equal(url.searchParams.get("embed"), "category,level,platform");
      return json({
        data: [
          {
            id: "run-legacy-igt",
            weblink: "https://www.speedrun.com/run/run-legacy-igt",
            game: "game-1",
            category: { data: { id: "category-1", name: "100%" } },
            level: { data: null },
            platform: { data: { id: "platform-1", name: "PC" } },
            date: "2017-05-24",
            submitted: "2017-05-24T12:00:00Z",
            times: {
              primary_t: 3033,
              realtime_t: 0,
              realtime_noloads_t: 0,
              ingame_t: 3033,
            },
            system: { platform: "platform-1", emulated: true },
            values: { "variable-1": "value-1" },
            videos: null,
          },
          {
            id: "run-current-rta-and-igt",
            weblink: "https://www.speedrun.com/run/run-current-rta-and-igt",
            game: "game-1",
            category: { data: { id: "category-1", name: "100%" } },
            level: { data: null },
            platform: { data: { id: "platform-1", name: "PC" } },
            date: "2024-06-10",
            submitted: "2024-06-10T12:00:00Z",
            times: {
              primary_t: 3921,
              realtime_t: 3921,
              realtime_noloads_t: 0,
              ingame_t: 2750,
            },
            system: { platform: "platform-1", emulated: false },
            values: { "variable-1": "value-1" },
            videos: null,
          },
        ],
        pagination: { max: 200, links: [] },
      });
    }

    if (url.pathname === "/api/v1/games/game-1") {
      assert.equal(url.searchParams.get("embed"), "variables");
      return json({
        data: {
          id: "game-1",
          names: { international: "Mock Game" },
          abbreviation: "mock-game",
          assets: {},
          ruleset: { "default-time": "realtime" },
          variables: {
            data: [{
              id: "variable-1",
              "is-subcategory": true,
              values: { values: { "value-1": { label: "Standard" } } },
            }],
          },
        },
      });
    }

    throw new Error(`Unexpected speedrun.com request: ${url}`);
  };

  process.env.ARCHIVE_CACHE_DIR = directory;
  try {
    const response = await render("/MockRunner");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /MOCKRUNNER/i);
    assert.match(html, /Mock Game/i);
    assert.match(html, />RTA</i);
    assert.match(html, /1:05:21/);
    assert.doesNotMatch(html, /45:50/);
    assert.doesNotMatch(html, /50:33/);
    assert.match(html, /1(?:<!-- -->)? PB(?!S)/i);
    assert.equal(requestedPaths.filter((item) => item.includes("/runs?")).length, 1);
    assert.equal(requestedPaths.filter((item) => item.includes("/games/")).length, 1);
    assert.ok(requestedPaths.every((item) => !item.includes("leaderboard")));
    assert.ok(requestedPaths.every((item) => !/\/(categories|levels|platforms)\//.test(item)));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ARCHIVE_CACHE_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});

test("server-renders shareable and embeddable passport routes", async () => {
  const passport = await render("/volpey/passport");
  assert.equal(passport.status, 200);
  const passportHtml = await passport.text();
  assert.match(passportHtml, /SPEEDRUN PASSPORT/i);
  assert.match(
    passportHtml,
    /class="accent-name" href="\/volpey">VOLPEY<\/a><span aria-hidden="true">\/<\/span><a href="\/volpey\/passport">PASSPORT<\/a>/i,
  );
  assert.match(passportHtml, /SHARE PASSPORT/);
  assert.match(passportHtml, /ENTRY RECORD/);
  assert.match(passportHtml, /PB STAMPS/);
  assert.match(passportHtml, /EMBED/);

  const embed = await render("/volpey/embed/passport");
  assert.equal(embed.status, 200);
  const embedHtml = await embed.text();
  assert.match(embedHtml, /SPEEDRUN PASSPORT/i);
  assert.match(embedHtml, /OPEN PASSPORT/);
  assert.doesNotMatch(embedHtml, /SHARE PASSPORT/);
});
