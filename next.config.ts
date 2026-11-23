import type { NextConfig } from "next";

const rushBanks = ["./content/6math/bank.json.gz", "./content/mentalist/bank-v4.json.gz", "./content/8math/bank.json.gz"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingIncludes: {
    "/api/rush": rushBanks,
    "/api/mentalist": rushBanks,
  },
};
export default nextConfig;
