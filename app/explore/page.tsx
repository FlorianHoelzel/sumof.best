import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoverableArchives } from "../archive-cache";
import "./explore.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Public Speedrun PB Archives",
  description:
    "Browse recently generated speedrun personal best histories, including verified PB milestones across games and categories.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Public Speedrun PB Archives | Sum of Best",
    description:
      "Browse visual histories of verified speedrun personal bests.",
    url: "/explore",
    type: "website",
  },
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function year(date: string) {
  return date ? date.slice(0, 4) : "-";
}

export default async function ExploreArchives() {
  const archives = (await listDiscoverableArchives()).slice(0, 250);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Public speedrun PB archives",
    url: "https://sumof.best/explore",
    description: "Recently generated speedrun personal best histories.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: archives.length,
      itemListElement: archives.map((archive, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${archive.name}'s speedrun PB history`,
        url: `https://sumof.best/${encodeURIComponent(archive.name)}`,
      })),
    },
  };

  return (
    <main className="archive-directory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="archive-directory-header">
        <Link href="/">SUM OF BEST</Link>
        <span>PUBLIC ARCHIVES</span>
      </header>

      <section className="archive-directory-intro">
        <p>RECENTLY GENERATED</p>
        <h1>Speedrun PB histories</h1>
        <p>
          Public archives created from verified speedrun.com runs, ordered by
          their latest refresh.
        </p>
      </section>

      {archives.length ? (
        <section className="archive-directory-list" aria-label="Public runner archives">
          <div className="archive-directory-labels" aria-hidden="true">
            <span>RUNNER</span>
            <span>ARCHIVE</span>
            <span>ACTIVE</span>
            <span>UPDATED</span>
          </div>
          {archives.map((archive) => (
            <Link
              className="archive-directory-row"
              href={`/${encodeURIComponent(archive.name)}`}
              key={archive.name.toLocaleLowerCase("en-US")}
            >
              <strong>@{archive.name}</strong>
              <span>
                {archive.pbRuns} PB{archive.pbRuns === 1 ? "" : "s"}
                <small>{archive.games} game{archive.games === 1 ? "" : "s"}</small>
              </span>
              <span>
                {year(archive.firstRunDate)}-{year(archive.latestRunDate)}
                <small>{archive.histories} categories</small>
              </span>
              <time dateTime={archive.lastModified}>
                {dateFormatter.format(new Date(archive.lastModified))}
              </time>
            </Link>
          ))}
        </section>
      ) : (
        <section className="archive-directory-empty">
          <h2>No public archives yet.</h2>
          <p>Generated runner archives will appear here automatically.</p>
          <Link href="/">SEARCH FOR A RUNNER</Link>
        </section>
      )}

      <footer className="archive-directory-footer">
        <Link href="/">SEARCH YOUR PB HISTORY</Link>
        <p>Verified run data sourced from speedrun.com</p>
      </footer>
    </main>
  );
}
