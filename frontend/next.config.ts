import type { NextConfig } from "next";

// srcdoc 교안 iframe은 이 CSP를 상속합니다. 교안 시뮬레이션에는 인라인 스크립트와
// 외부 CDN이 필요하므로 script-src는 두지 않고, 스크립트 격리는 iframe sandbox가 맡습니다.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
