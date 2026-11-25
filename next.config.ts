import type { NextConfig } from "next";

const curriculumBanks = ["./content/6math/bank.json.gz", "./content/mentalist/bank-v5.json.gz", "./content/8math/bank.json.gz"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingIncludes: {
    "/api/rush": curriculumBanks,
    "/api/mentalist": curriculumBanks,
    "/verification": curriculumBanks,
    "/verification/*": curriculumBanks,
  },
};
export default nextConfig;
