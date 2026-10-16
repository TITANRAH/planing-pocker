import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No escribir AGENTS.md: en macOS colisiona con nuestro agents.md
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
