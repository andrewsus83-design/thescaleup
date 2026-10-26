import type { NextConfig } from "next";

// The public landing site and the client dashboard are archived (see archive/). Their old URLs open the login instead of a 404.
// "/" is the login itself (app/page.tsx). Non-permanent on purpose: this is "for now", not forever.
const ARCHIVED_PATHS = ["/cara-kerja", "/executive-board", "/faq", "/mulai", "/blog/:path*", "/scalehub/:path*", "/dashboard/:path*"];

const nextConfig: NextConfig = {
  async redirects() {
    return ARCHIVED_PATHS.map((source) => ({ source, destination: "/admin/login", permanent: false }));
  },
};

export default nextConfig;
