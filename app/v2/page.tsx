import type { Metadata } from "next";
import { demoRunnerData } from "../data/demo-runner";
import BackToSearchButton from "./back-to-search-button";
import DemoArchivePreview from "./demo-archive-preview";
import V2LandingPage from "./v2-landing-page";
import "./v2.css";

export const metadata: Metadata = {
  title: "Sum of Best | Your speedrun PB history",
  description:
    "Turn a public speedrun.com profile into a browsable archive of every verified personal best.",
  robots: { index: false, follow: false },
};

export default function LandingPageV2Route() {
  return (
    <>
      <V2LandingPage />
      <DemoArchivePreview data={demoRunnerData} />
      <BackToSearchButton />
    </>
  );
}
