import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The scraper lives outside this app dir and is imported directly by the run
  // route, so file tracing must start at the leadgen root to include it.
  // fileURLToPath is required here: URL.pathname yields "/D:/..." on Windows,
  // which Next cannot canonicalize.
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
};

export default nextConfig;
