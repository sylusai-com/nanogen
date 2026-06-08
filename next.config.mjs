/** @type {import('next').NextConfig} */

// Security headers applied to every response. Tuned for an authenticated
// app that renders untrusted AI-generated banner HTML inside a sandboxed
// iframe (sandbox="allow-scripts" with no allow-same-origin) — that's our
// XSS containment story.
//
// Notes on each header:
//  - Strict-Transport-Security: ship over HTTPS, includeSubDomains, 1 year.
//  - X-Frame-Options DENY: nobody else may iframe this app (clickjacking).
//  - X-Content-Type-Options: stop MIME sniffing — serve only what we declare.
//  - Referrer-Policy: same-origin: never leak full URLs to third parties.
//  - Permissions-Policy: opt out of features we never use.
//  - Cross-Origin-Opener-Policy: isolate window.opener for popup auth.
//  - Cross-Origin-Resource-Policy: only same-origin resources by default.
//  - Content-Security-Policy: explicit allowlist for everything the app loads.
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "browsing-topics=()",
      "interest-cohort=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control",       value: "on" },
  { key: "X-XSS-Protection",             value: "0" },
  {
    key: "Content-Security-Policy",
    // Allow:
    //  - script-src: self + unsafe-inline (Next bootstrap injects inline)
    //                + unsafe-eval (some libs use it).
    //  - connect-src: self + https + Supabase WS.
    //  - img-src: data: + blob: (svg foreignObject + downloads) + https:.
    //  - font-src: self + data: (system fonts only — we don't fetch web fonts).
    //  - frame-src: 'self' so the sandboxed banner iframe is allowed.
    //  - frame-ancestors: 'none' (matches X-Frame-Options DENY).
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' blob: data:",
      "media-src 'self' data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  // Forward declare every route should get the security headers; we don't
  // exclude /api because their JSON responses still benefit from
  // X-Content-Type-Options / no-store cache hints downstream.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },

  // Produce a minimal standalone server bundle for Docker/Cloud Run.
  output: "standalone",

  // Be conservative with the React strict-mode default and do not leak
  // the framework signature in the X-Powered-By header.
  poweredByHeader: false,
  reactStrictMode: true,

  // We render external Unsplash photos as background images. The
  // banner-template prompt lists curated host(s); declare them so any
  // future use of next/image (and the image proxy) is locked down.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.openai.com" },
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
