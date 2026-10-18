import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

/**
 * SyncBeat Next.js configuration.
 *
 * NOTE: @ducanh2912/next-pwa is a webpack plugin, so `dev` and `build` scripts
 * run with the `--webpack` flag (see package.json). Tailwind is wired through
 * PostCSS (postcss.config.mjs) so it works with either bundler.
 */
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false, // never hard-reload mid-session; it would kill playback
  // Don't precache multi-MB tracks at install time; runtime cache handles them.
  publicExcludes: ["!noprecache/**/*", "!audio/**/*"],
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // Bundled demo tracks + any same-origin audio: cache-first so rooms
        // can be re-joined offline and tracks decode instantly on rejoin.
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith("/audio/"),
        handler: "CacheFirst",
        options: {
          cacheName: "syncbeat-audio",
          rangeRequests: true,
          expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Remote audio (CDNs). Opaque/partial responses are skipped.
        urlPattern: /\.(?:mp3|wav|ogg|m4a|aac|flac|webm)(?:\?.*)?$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "syncbeat-remote-audio",
          rangeRequests: true,
          expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
