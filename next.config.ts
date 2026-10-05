import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The seating plan PDF reads its fonts and the logo from disk at runtime,
  // so they have to ship with the server code when deployed.
  outputFileTracingIncludes: {
    "/exams/*/pdf": ["./src/assets/fonts/*", "./public/alfaisal-logo.png"],
  },
};

export default nextConfig;
