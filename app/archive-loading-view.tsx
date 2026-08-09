"use client";

import Link from "next/link";
import { useEffect } from "react";
import "./archive-loading.css";

export default function ArchiveLoadingView() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <main className="archive-loading-v2" aria-busy="true" aria-live="polite">
      <header className="archive-loading-v2-header">
        <Link href="/" aria-label="Sum of Best home">
          SUM OF BEST
        </Link>
      </header>

      <section className="archive-loading-v2-stage" role="status">
        <div className="archive-loading-v2-copy">
          <span>BUILDING YOUR ARCHIVE</span>
          <h1>Collecting verified runs.</h1>
          <p>Larger profiles can take a little longer.</p>
        </div>

        <div className="archive-loading-v2-progress" aria-hidden="true">
          <div>
            <span>RUN HISTORY</span>
            <span>INDEXING</span>
          </div>
          <i><span /></i>
        </div>
      </section>
    </main>
  );
}
