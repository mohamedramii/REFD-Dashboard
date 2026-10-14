import type { MetadataRoute } from "next";

// لوحة داخلية فيها بيانات صحية: ممنوع الأرشفة.
// صور المشاركة بس مسموحة، عشان بوتات معاينة الروابط (زي X) بتحترم robots.txt
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/opengraph-image", "/twitter-image"], disallow: "/" },
  };
}
