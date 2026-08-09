import { demoRunnerData } from "./data/demo-runner";
import BackToSearchButton from "./v2/back-to-search-button";
import DemoArchivePreview from "./v2/demo-archive-preview";
import V2LandingPage from "./v2/v2-landing-page";
import "./v2/v2.css";

export default function Home() {
  return (
    <>
      <V2LandingPage />
      <DemoArchivePreview data={demoRunnerData} />
      <BackToSearchButton />
    </>
  );
}
