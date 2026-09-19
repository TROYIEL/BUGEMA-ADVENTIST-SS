import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { BASE, launchBrowser } from "./lib/browser.mjs";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const pages = [
  "/", "/about", "/about/leadership", "/academics", "/academics/subjects",
  "/admissions", "/admissions/requirements", "/admissions/apply",
  "/admissions/application-status", "/news", "/events", "/gallery",
  "/gallery/life-at-bass", "/contact", "/search?q=school", "/policies/privacy",
].map((p) => ({ app: "web", url: BASE + p }));

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

/**
 * Accessibility + responsive audit.
 *
 * For each page, at desktop and phone width: runs axe-core and keeps
 * serious/critical violations, checks whether the page scrolls horizontally,
 * and lists any element wider than the viewport. Returns the failures.
 */
export async function runA11y() {
const browser = await launchBrowser();
const results = [];

try {
  for (const { app, url } of pages) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });

      let status = 0;
      try {
        const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });
        status = res?.status() ?? 0;
      } catch (e) {
        results.push({ app, url, vp: vp.name, error: String(e.message).slice(0, 80) });
        await page.close();
        continue;
      }

      await page.addScriptTag({ content: axeSource });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
        });
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          sample: v.nodes[0]?.target?.[0] ?? "",
        }));
      });

      const overflow = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const vw = window.innerWidth;
        const wide = [...document.querySelectorAll("body *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > vw + 1 || r.right > vw + 1;
          })
          .slice(0, 4)
          .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : ""}`);
        return { scrolls: docW > vw + 1, docW, vw, wide };
      });

      results.push({
        app, url: url.replace(BASE, "") || "/", vp: vp.name, status,
        violations: axe.filter((v) => v.impact === "serious" || v.impact === "critical"),
        minor: axe.filter((v) => v.impact === "moderate" || v.impact === "minor").length,
        overflow,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

// ---- report ---------------------------------------------------------------
const byIssue = new Map();
let overflowPages = [];
let errors = [];

for (const r of results) {
  if (r.error) { errors.push(r); continue; }
  if (r.overflow?.scrolls) overflowPages.push(r);
  for (const v of r.violations ?? []) {
    const key = `${v.id} — ${v.help}`;
    if (!byIssue.has(key)) byIssue.set(key, { impact: v.impact, pages: new Set(), sample: v.sample });
    byIssue.get(key).pages.add(`${r.app}${r.url}@${r.vp}`);
  }
}

console.log(`\n${results.length} page×viewport checks\n`);
console.log("SERIOUS / CRITICAL AXE VIOLATIONS (grouped)");
if (byIssue.size === 0) console.log("  none");
for (const [key, v] of [...byIssue].sort((a, b) => b[1].pages.size - a[1].pages.size)) {
  console.log(`  [${v.impact}] ${key}`);
  console.log(`      on ${v.pages.size} page-views, e.g. ${[...v.pages].slice(0, 3).join(", ")}`);
  console.log(`      sample: ${v.sample}`);
}

console.log("\nHORIZONTAL OVERFLOW (page scrolls sideways)");
if (overflowPages.length === 0) console.log("  none");
for (const r of overflowPages) {
  console.log(`  ${r.app}${r.url} @${r.vp}: ${r.overflow.docW}px in ${r.overflow.vw}px — ${r.overflow.wide.join(" | ")}`);
}

if (errors.length) {
  console.log("\nCOULD NOT LOAD");
  for (const r of errors) console.log(`  ${r.app} ${r.url} @${r.vp}: ${r.error}`);
}

const non200 = results.filter((r) => r.status && r.status !== 200);
if (non200.length) {
  console.log("\nNON-200");
  for (const r of non200) console.log(`  ${r.app}${r.url} @${r.vp}: ${r.status}`);
}

const failures = [];
for (const [key, v] of byIssue) failures.push(`axe ${v.impact}: ${key} (${v.pages.size} page-views)`);
for (const r of overflowPages) failures.push(`horizontal overflow: ${r.app}${r.url} @${r.vp}`);
for (const r of errors) failures.push(`could not load: ${r.app} ${r.url}`);
return failures;
}
