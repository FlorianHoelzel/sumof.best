import type { Metadata } from "next";
import { demoRunnerData } from "./data/demo-runner";
import BackToSearchButton from "./v2/back-to-search-button";
import DemoArchivePreview from "./v2/demo-archive-preview";
import V2LandingPage from "./v2/v2-landing-page";
import "./v2/v2.css";

export const metadata: Metadata = {
  title: "Speedrun PB History and Personal Best Archive",
  description:
    "Explore every verified speedrun personal best in one visual history. Search any public speedrun.com runner to see current and obsolete PBs by game and category.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Speedrun PB History and Personal Best Archive | Sum of Best",
    description:
      "Turn any public speedrun.com profile into a visual archive of verified personal bests.",
    url: "/",
    type: "website",
  },
};

const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Sum of Best",
  url: "https://sumof.best",
  applicationCategory: "SportsApplication",
  operatingSystem: "Any",
  isAccessibleForFree: true,
  description:
    "A visual archive of verified speedrun personal best histories from speedrun.com.",
  featureList: [
    "Current and obsolete personal bests",
    "Game and category PB progression",
    "Shareable PB feeds and speedrun passports",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <V2LandingPage />
      <DemoArchivePreview data={demoRunnerData} />
      <BackToSearchButton />
    </>
  );
}
