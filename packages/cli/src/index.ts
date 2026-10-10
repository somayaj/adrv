#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const webDir = path.join(repoRoot, "packages", "web");

const args = process.argv.slice(2);
const command = args[0] ?? "graph";

if (command === "graph" || command === "dev") {
  const rootFlag = args.indexOf("--root");
  const adrRoot =
    rootFlag >= 0 && args[rootFlag + 1]
      ? path.resolve(args[rootFlag + 1])
      : path.join(repoRoot, "docs", "adr");

  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "-w", "@adrv/web"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, ADRV_ROOT: adrRoot },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (command === "help" || command === "--help") {
  console.log(`adrv — ADR dependency & architecture visualizer

Usage:
  adrv graph [--root <path>]   Open Tailwind UI (default: docs/adr)
  adrv dev [--root <path>]     Same as graph

Environment:
  ADRV_ROOT   ADR directory when using npm run dev in @adrv/web
`);
} else {
  console.error(`Unknown command: ${command}. Try: adrv graph`);
  process.exit(1);
}
