import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // Only the clients' own mini-sites (/site/…) are meant to be found. The login, the Chat Room, the report links and the
    // rest stay out of search. (The public landing site and its sitemap are archived.)
    rules: [
      {
        userAgent: "*",
        allow: "/site/",
        disallow: "/",
      },
    ],
  };
}
