/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const useGithubPagesPath = process.env.NEXT_PUBLIC_BASE_PATH === "/Crypgo";

const nextConfig = {
  skipTrailingSlashRedirect: true,
  basePath: isProd && useGithubPagesPath ? "/Crypgo" : "",
  assetPrefix: isProd && useGithubPagesPath ? "/Crypgo/" : "",
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*/",
        destination: `${process.env.CRYPGO_BACKEND_URL || "http://127.0.0.1:8000"}/api/:path*/`,
      },
      {
        source: "/backend-api/:path*",
        destination: `${process.env.CRYPGO_BACKEND_URL || "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;