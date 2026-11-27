import type { NextConfig } from "next";

const curriculumBanks = [
  "./content/6math/bank.json.gz",
  "./content/mentalist/bank-v7.json.gz",
  "./content/mentalist/bank-v9.json.gz",
  "./content/8math/bank.json.gz",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingIncludes: {
    "/api/mentalist": curriculumBanks,
    "/verification": curriculumBanks,
    "/verification/*": curriculumBanks,
  },
};
export default nextConfig;
