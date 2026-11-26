import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getPublicProjection } from "@/lib/gd/public";

export default function robots(): MetadataRoute.Robots {
  const projection = getPublicProjection();
  if (!projection || projection.preview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/gd", "/sitemap.xml"], disallow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
