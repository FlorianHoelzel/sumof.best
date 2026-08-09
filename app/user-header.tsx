"use client";

import { useState } from "react";
import Link from "next/link";
import type { SiteData } from "./pb-history";

export default function UserHeader({
  profile,
  page,
}: {
  profile: SiteData["profile"];
  page?: "PB FEED" | "PASSPORT";
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const archivePath = `/${encodeURIComponent(profile.name)}`;
  const profileAvatar = profile.avatar;
  const isDemo = profile.profileUrl.startsWith("/");

  return (
    <header className="site-header">
      <div className="brand">
        <a
          className="brand-avatar-link"
          href={archivePath}
          aria-label={`${profile.name}'s Sum of Best archive`}
        >
          {profileAvatar && !avatarFailed ? (
            <img
              className="brand-avatar"
              src={profileAvatar}
              alt=""
              width="34"
              height="34"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span className="brand-avatar-fallback" aria-hidden="true">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </a>
        <span
          className="brand-breadcrumb"
          role="navigation"
          aria-label="Breadcrumb"
        >
          <Link href="/">SUM OF BEST</Link>
          <span aria-hidden="true">/</span>
          <a className="accent-name" href={archivePath}>
            {profile.name.toUpperCase()}
          </a>
          {page && (
            <>
              <span aria-hidden="true">/</span>
              <a
                href={page === "PB FEED" ? `${archivePath}/feed` : `${archivePath}/passport`}
              >
                {page}
              </a>
            </>
          )}
        </span>
      </div>
      <nav aria-label="Primary">
        <a href={`${archivePath}#overview`}>OVERVIEW</a>
        <a href={`${archivePath}#games`}>THE RUNS</a>
        <a href={`${archivePath}/feed`}>PB FEED</a>
        <a href={`${archivePath}/passport`}>PASSPORT</a>
        <a
          href={profile.profileUrl}
          target={isDemo ? undefined : "_blank"}
          rel={isDemo ? undefined : "noreferrer"}
        >
          {isDemo ? "DEMO DATA" : "SPEEDRUN.COM ↗"}
        </a>
      </nav>
    </header>
  );
}
