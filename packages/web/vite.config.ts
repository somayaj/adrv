import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { loadAdrGraph } from "../core/dist/index.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** ADRV_ROOT is resolved from repo root, not Vite's cwd (packages/web). */
function resolveAdrRoot(): string {
  const raw = process.env.ADRV_ROOT;
  if (!raw?.trim()) return path.join(repoRoot, "docs", "adr");
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(repoRoot, raw);
}

function adrApiPlugin(adrRoot: string): Plugin {
  return {
    name: "adrv-api",
    configureServer(server) {
      server.middlewares.use("/api/graph", async (_req, res) => {
        try {
          const graph = await loadAdrGraph(adrRoot);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(graph));
        } catch (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Failed to load ADRs",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(() => {
  const adrRoot = resolveAdrRoot();

  return {
    plugins: [react(), tailwindcss(), adrApiPlugin(adrRoot)],
    server: {
      port: 5173,
      open: true,
      proxy: process.env.ADRV_PROXY_API
        ? { "/api": { target: process.env.ADRV_PROXY_API, changeOrigin: true } }
        : undefined,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
