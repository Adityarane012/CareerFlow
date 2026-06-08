import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix: Next.js detected lockfiles in parent directories (C:\Users\Aditya Rane\package-lock.json).
  // Setting outputFileTracingRoot to this project's own directory silences the false-positive warning.
  outputFileTracingRoot: path.join(__dirname),

  // Fix: pdf-parse uses dynamic require() internally which Turbopack/webpack corrupts when bundled.
  serverExternalPackages: ['pdf-parse', 'puppeteer', 'puppeteer-core', '@sparticuz/chromium'],
};

export default nextConfig;
