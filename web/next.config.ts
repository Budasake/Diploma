import type { NextConfig } from "next";

// Where the FastAPI backend runs. Override with API_URL in production.
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser calls /api/* on the Next.js site, and Next.js forwards it to
  // FastAPI. Same origin for the browser = no CORS problems, and login cookies
  // stay first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
