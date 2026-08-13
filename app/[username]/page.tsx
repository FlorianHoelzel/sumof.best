import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import speedrunData from "../data/speedruns.json";
import "../archive-v2.css";
import PBHistory from "../pb-history";
import { getUserArchive } from "../archive-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function archiveFor(username: string) {
  const decodedUsername = decodeURIComponent(username);
  return decodedUsername.toLowerCase() === speedrunData.profile.name.toLowerCase()
    ? speedrunData
    : getUserArchive(decodedUsername);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ history?: string | string[] }>;
}): Promise<Metadata> {
  const { username } = await params;
  const query = await searchParams;
  const requestedName = decodeURIComponent(username);
  const data = await archiveFor(username);

  if (!data) {
    return {
      title: `${requestedName}'s speedrun archive`,
      robots: { index: false, follow: false },
    };
  }

  const name = data.profile.name;
  const canonical = `/${encodeURIComponent(name)}`;
  const requestedHistory = Array.isArray(query.history)
    ? query.history[0]
    : query.history;
  const sharedHistory = requestedHistory
    ? data.histories.find((history) => history.id === requestedHistory)
    : undefined;
  const sharedCategory = sharedHistory
    ? [sharedHistory.categoryName, sharedHistory.levelName, sharedHistory.variant]
        .filter(Boolean)
        .join(" / ")
    : "";
  const socialImage = sharedHistory
    ? `${canonical}/social-card?history=${encodeURIComponent(sharedHistory.id)}`
    : `${canonical}/social-card`;
  const title = sharedHistory
    ? `${name}'s ${sharedHistory.gameName} PB history`
    : `${name}'s speedrun PB history`;
  const description = sharedHistory
    ? `${sharedCategory}: ${sharedHistory.runs.length} verified personal-best milestone${sharedHistory.runs.length === 1 ? "" : "s"}, with a current time of ${sharedHistory.runs.at(-1)!.time}.`
    : `${data.stats.pbRuns} personal-best milestones across ${data.stats.games} games and ${data.stats.histories} categories, including current and obsolete speedruns.`;
  const image = {
    url: socialImage,
    width: 1200,
    height: 630,
    alt: sharedHistory
      ? `${name}'s ${sharedHistory.gameName} ${sharedCategory} PB card`
      : `${name}'s Sum of Best speedrun archive`,
  };

  return {
    title,
    description,
    alternates: { canonical },
    robots: data.source === "demo"
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: sharedHistory
        ? `${canonical}?history=${encodeURIComponent(sharedHistory.id)}`
        : canonical,
      siteName: "Sum of Best",
      locale: "en_US",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function UserArchive({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = await archiveFor(username);

  if (!data) notFound();

  if (!data.histories.length) {
    return (
      <main className="empty-archive">
        <Link className="empty-brand" href="/">
          SUM OF BEST
        </Link>
        <section>
          <span>PROFILE FOUND</span>
          <h1>@{data.profile.name}</h1>
          <p>
            This speedrun.com profile doesn’t have any verified runs to build
            an archive from yet.
          </p>
          <a href={data.profile.profileUrl} target="_blank" rel="noreferrer">
            VIEW ON SPEEDRUN.COM ↗
          </a>
        </section>
      </main>
    );
  }

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `https://sumof.best/${encodeURIComponent(data.profile.name)}`,
    name: `${data.profile.name}'s speedrun PB history`,
    description: `${data.stats.pbRuns} personal-best milestones across ${data.stats.games} games.`,
    dateModified: data.generatedAt,
    mainEntity: {
      "@type": "Person",
      name: data.profile.name,
      url: data.profile.profileUrl,
      image: data.profile.avatar ?? undefined,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "Sum of Best",
      url: "https://sumof.best",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PBHistory data={data} heroVariant="stats-latest" />
    </>
  );
}
