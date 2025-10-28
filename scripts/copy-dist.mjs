#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const docsDir = path.join(root, "docs");

if (!fs.existsSync(distDir)) {
  console.error("dist directory not found. Run `npm run build` first.");
  process.exit(1);
}

fs.rmSync(docsDir, { recursive: true, force: true });
fs.cpSync(distDir, docsDir, { recursive: true });

console.log("Copied dist -> docs");
