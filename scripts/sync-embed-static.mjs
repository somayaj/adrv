#!/usr/bin/env node
/**
 * Copy packages/web/dist → static/ for rust-embed (cargo install / crates.io).
 * Run after: npm run build -w @adrv/web
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "packages", "web", "dist");
const staticDir = path.join(root, "static");

if (!existsSync(path.join(dist, "index.html"))) {
  console.error("Missing packages/web/dist — run: npm run build -w @adrv/web");
  process.exit(1);
}

mkdirSync(staticDir, { recursive: true });
for (const name of readdirSync(staticDir)) {
  rmSync(path.join(staticDir, name), { recursive: true, force: true });
}
cpSync(dist, staticDir, { recursive: true });
console.log(`Synced ${dist} → ${staticDir}`);
