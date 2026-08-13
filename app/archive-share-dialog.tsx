"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ShareStatus = "idle" | "copied" | "shared" | "error";

export default function ArchiveShareDialog({
  username,
  historyId,
  historyAnchor,
  gameName,
  categoryLabel,
  onClose,
}: {
  username: string;
  historyId: string;
  historyAnchor: string;
  gameName: string;
  categoryLabel: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const archivePath = `/${encodeURIComponent(username)}`;
  const historyQuery = `history=${encodeURIComponent(historyId)}`;
  const cardPath = `${archivePath}/social-card?${historyQuery}&v=5`;
  const sharedArchivePath = `${archivePath}?${historyQuery}#${historyAnchor}`;
  const filename = `${username.toLocaleLowerCase("en-US")}-${gameName
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-pb.png`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${sharedArchivePath}`,
      );
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function shareArchive() {
    const shareData = {
      title: `${username}'s ${gameName} PB history`,
      text: `${categoryLabel}: see ${username}'s verified ${gameName} personal best history.`,
      url: `${window.location.origin}${sharedArchivePath}`,
    };

    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share(shareData);
      setStatus("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    }
  }

  return createPortal(
    <div
      className="embed-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="embed-dialog archive-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${username}'s ${gameName} PB history`}
      >
        <div className="embed-dialog-heading">
          <div>
            <span>SHARE THIS GAME</span>
            <h4>{gameName}</h4>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share dialog">
            &times;
          </button>
        </div>
        <p>
          {categoryLabel}. Share this PB history with its own card, or download
          the image.
        </p>
        <div className="archive-share-preview">
          {/* The card is generated dynamically for each runner. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardPath}
            alt={`${username}'s ${gameName} ${categoryLabel} personal best card`}
            width="1200"
            height="630"
          />
        </div>
        <div className="archive-share-actions">
          <button type="button" className="archive-share-primary" onClick={shareArchive}>
            {status === "shared" ? "SHARED" : "SHARE"}
          </button>
          <button type="button" className="archive-share-secondary" onClick={copyLink}>
            {status === "copied" ? "COPIED" : "COPY LINK"}
          </button>
          <a href={cardPath} download={filename}>
            DOWNLOAD CARD
          </a>
        </div>
        {status === "error" && (
          <p className="archive-share-error" role="status">
            Could not copy the link. You can still download the card.
          </p>
        )}
      </section>
    </div>,
    document.body,
  );
}
