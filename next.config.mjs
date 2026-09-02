import path from "node:path";

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const useGithubPagesPath = process.env.NEXT_PUBLIC_BASE_PATH === "/Crypgo";

const nextConfig = {
  skipTrailingSlashRedirect: true,
  basePath: isProd && useGithubPagesPath ? "/Crypgo" : "",
  assetPrefix: isProd && useGithubPagesPath ? "/Crypgo/" : "",
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd(), "src"),
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*/",
        destination: `${process.env.CRYPGO_BACKEND_URL || "https://crypgo-api.onrender.com"}/api/:path*/`,
      },
      {
        source: "/backend-api/:path*",
        destination: `${process.env.CRYPGO_BACKEND_URL || "https://crypgo-api.onrender.com"}/api/:path*`,
      },
    ];
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;