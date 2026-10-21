import type { MetadataRoute } from "next";

// Internal dashboard with health data: no indexing.
// Only share images are allowed, because link-preview bots (like X) respect robots.txt
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/opengraph-image", "/twitter-image"], disallow: "/" },
  };
}
