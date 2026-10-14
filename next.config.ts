import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The seating plan PDF reads its fonts and the logo from disk at runtime,
  // so they have to ship with the server code when deployed. It's built by
  // the PDF download and by the seat emails on the exam page.
  outputFileTracingIncludes: {
    "/exams/**": ["./src/assets/fonts/*", "./public/alfaisal-logo.png"],
  },
  // Stop next dev from adding extra docs files to the project.
  agentRules: false,
};

export default nextConfig;
