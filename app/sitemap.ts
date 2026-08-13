import type { MetadataRoute } from "next";
import speedrunData from "./data/speedruns.json";
import { listDiscoverableArchives } from "./archive-cache";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cachedArchives = await listDiscoverableArchives();
  const archives = new Map(
    [
      {
        name: speedrunData.profile.name,
        lastModified: speedrunData.generatedAt,
      },
      ...cachedArchives,
    ].map((archive) => [archive.name.toLocaleLowerCase("en-US"), archive]),
  );

  return [
    {
      url: "https://sumof.best",
      changeFrequency: "weekly",
      priority: 1,
    },
    ...[...archives.values()].map((archive) => ({
      url: `https://sumof.best/${encodeURIComponent(archive.name)}`,
      lastModified: archive.lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
