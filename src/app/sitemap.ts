import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { gdCityMap } from "@/lib/gd/categories";
import { getPublicProjection } from "@/lib/gd/public";

// Only source-backed routes belong in the public sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const projection = getPublicProjection();
  if (!projection || projection.preview) return [];
  const cities = [...new Set(projection.records.map((record) => record.citySlug))]
    .filter((slug) => gdCityMap.has(slug))
    .sort();
  return [
    { url: absoluteUrl("/gd") },
    { url: absoluteUrl("/gd/license") },
    { url: absoluteUrl("/gd/methodology") },
    ...cities.map((slug) => ({ url: absoluteUrl("/gd/" + slug) })),
  ];
}
