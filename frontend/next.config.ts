import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitSha = process.env.NEXT_PUBLIC_GIT_SHA || "dev";

// If env var is not set or matches default, try to get from git
if (gitSha === "dev") {
  try {
    gitSha = execSync("git rev-parse --short HEAD").toString().trim();
  } catch (e) {
    // git not available or not a git repo
    console.warn("Could not get git version, defaulting to dev");
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.1.99:3000", "localhost:3000", "192.168.1.99", "100.99.98.97", "100.99.98.97:3000"],
      bodySizeLimit: '50mb'
    }
  },
  // For Next.js 16 compatibility with dev server origins
  allowedDevOrigins: [
    "192.168.1.99:3000",
    "localhost:3000",
    "192.168.1.99",
    "http://192.168.1.99:3000",
    "http://localhost:3000",
    "100.99.98.97",
    "100.99.98.97:3000",
    "http://100.99.98.97:3000"
  ],

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      },
      {
        source: "/_next/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ]
      }
    ]
  },

  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    console.log('Next.js Rewrites: Using backendUrl =', backendUrl);
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
