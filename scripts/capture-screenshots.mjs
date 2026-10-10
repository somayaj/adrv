import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "docs", "screenshots");
const baseUrl = process.env.ADRV_URL ?? "http://127.0.0.1:8080";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForSelector('nav[aria-label="Views"] button');

/** Pick first ADR in the decisions list so Links / Timeline / Architecture have context. */
async function selectFirstAdr() {
  const list = page.locator("#adrv-nav-list button").filter({ hasText: /^\d{4}/ });
  if (await list.count()) {
    await list.first().click();
    await page.waitForTimeout(400);
  }
}

const shots = [
  { name: "dependencies", label: "Dependencies", before: async () => {} },
  { name: "links", label: "Links", before: selectFirstAdr },
  { name: "timeline", label: "Timeline", before: selectFirstAdr },
  { name: "architecture", label: "Architecture", before: selectFirstAdr },
];

const views = page.getByRole("navigation", { name: "Views" });

for (const { name, label, before } of shots) {
  await views.getByRole("button", { name: label, exact: true }).click();
  await before();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: false,
  });
}

await browser.close();
console.log(`Wrote ${shots.length} screenshots to ${outDir}`);
