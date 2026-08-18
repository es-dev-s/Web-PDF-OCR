import type { NextConfig } from "next";

function backendOrigin() {
  const raw = (
    process.env.BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://127.0.0.1:8001"
  ).trim();
  let origin = raw.replace(/\/+$/, "");
  if (!origin) origin = "http://127.0.0.1:8001";
  if (!/^https?:\/\//i.test(origin)) origin = `https://${origin}`;
  return origin;
}

const nextConfig: NextConfig = {
  experimental: {
    // Engine title extraction often exceeds the default 30s rewrite proxy.
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${backendOrigin()}/:path*`,
      },
    ];
  },
};

export default nextConfig;
