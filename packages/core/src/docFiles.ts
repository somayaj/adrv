import path from "node:path";

export const DOC_GLOBS = [
  "**/*.md",
  "**/*.markdown",
  "**/*.mdx",
  "**/*.txt",
  "**/*.text",
  "**/*.rst",
  "**/*.adoc",
  "**/*.asciidoc",
];

const SKIP_FILES = new Set(
  [
    "readme.md",
    "changelog.md",
    "license",
    "license.md",
    "license.txt",
    "contributing.md",
    "code_of_conduct.md",
  ].map((s) => s.toLowerCase()),
);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  ".cursor",
  ".vite",
]);

export function shouldSkipDocument(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  if (SKIP_FILES.has(base)) return true;
  if (base.startsWith("_") || base.startsWith(".")) return true;
  const parts = filePath.split(path.sep);
  return parts.some((p) => SKIP_DIRS.has(p.toLowerCase()));
}
