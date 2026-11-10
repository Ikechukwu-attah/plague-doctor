import type { Metadata } from "next";
import { SOCIAL_IMAGE_ALT, SOCIAL_SITE_NAME, type SocialCopy } from "@/ui-copy/social";

/**
 * Open Graph + Twitter metadata for one route. Static copy only: no data is fetched, so a
 * shared link never carries a place name, date or measurement (UI-19.30).
 * og:image / twitter:image come from the file-convention images in src/app.
 */
export function socialMetadata(copy: SocialCopy): Metadata {
  return {
    title: copy.title,
    description: copy.description,
    openGraph: {
      title: copy.title,
      description: copy.description,
      siteName: SOCIAL_SITE_NAME,
      type: "website",
      locale: "en_CA",
      // A route-level openGraph object replaces the file-convention image, so name it explicitly.
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SOCIAL_IMAGE_ALT, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [{ url: "/twitter-image", width: 1200, height: 630, alt: SOCIAL_IMAGE_ALT }],
    },
  };
}
