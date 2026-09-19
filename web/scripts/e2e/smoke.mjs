/**
 * Smoke test: every public route answers 200, nothing administrative is
 * served from this origin, and the security headers are present. Read-only.
 */
import { BASE } from "./lib/browser.mjs";

const PUBLIC_ROUTES = [
  "/", "/about", "/about/history", "/about/leadership", "/academics",
  "/academics/departments", "/academics/subjects", "/admissions",
  "/admissions/requirements", "/admissions/how-to-apply", "/admissions/apply",
  "/admissions/application-status", "/student-life", "/news", "/events",
  "/gallery", "/contact", "/search?q=school", "/policies/privacy",
  "/sitemap.xml", "/robots.txt", "/opengraph-image",
];

async function status(url) {
  const res = await fetch(url, { redirect: "manual" });
  return res.status;
}

export async function runSmoke() {
  const failures = [];
  const check = (ok, label) => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}`);
    if (!ok) failures.push(label);
  };

  console.log("\nPUBLIC ROUTES");
  for (const route of PUBLIC_ROUTES) {
    const s = await status(BASE + route);
    check(s === 200, `${route} -> ${s}`);
  }
  check((await status(BASE + "/does-not-exist")) === 404, "/does-not-exist -> 404");
  check((await status(BASE + "/admin")) === 404, "/admin is not served by the public site");
  check((await status(BASE + "/login")) === 404, "/login is not served by the public site");

  console.log("\nHEADERS");
  const res = await fetch(BASE + "/");
  check(res.headers.get("strict-transport-security")?.includes("max-age"), "HSTS present");
  check(res.headers.get("x-content-type-options") === "nosniff", "nosniff present");
  check(res.headers.get("x-frame-options") === "DENY", "X-Frame-Options present");

  return failures;
}
