import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Sum of Best - Your speedrun PB history";
  const description =
    "Turn any public speedrun.com profile into an interactive history of current and obsolete personal bests.";

  return {
    metadataBase: new URL("https://sumof.best"),
    title: {
      default: title,
      template: "%s | Sum of Best",
    },
    description,
    applicationName: "Sum of Best",
    keywords: [
      "speedrunning",
      "speedrun personal bests",
      "PB history",
      "speedrun.com",
      "obsolete runs",
    ],
    authors: [{ name: "Sum of Best", url: "https://sumof.best" }],
    creator: "Sum of Best",
    publisher: "Sum of Best",
    referrer: "origin-when-cross-origin",
    verification: {
      google: "JeLkuzRbmBwi5uiI3t9g6JZV1r75RKrejPkG7kxkiy0",
    },
    alternates: { canonical: "/" },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://sumof.best",
      siteName: "Sum of Best",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Sum of Best",
    url: "https://sumof.best",
    description:
      "Interactive histories of current and obsolete speedrun personal bests.",
    inLanguage: "en",
    isAccessibleForFree: true,
  };

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg?v=run-replay-2" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg?v=run-replay-2" />
        <script
          defer
          src="https://stats.sumof.best/script.js"
          data-website-id="b586f22e-d4e3-4a55-9154-c9f44325a61c"
          data-domains="sumof.best,www.sumof.best"
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
