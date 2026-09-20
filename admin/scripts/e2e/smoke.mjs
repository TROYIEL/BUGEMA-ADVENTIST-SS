/**
 * Smoke test: the app is gated when signed out, an authorised administrator
 * can reach every module, and the security headers are present.
 *
 * Read-only apart from the throwaway session it signs in with.
 */
import { BASE } from "./lib/browser.mjs";

const ADMIN_ROUTES = [
  "/", "/applications", "/documents", "/requirements", "/academic-years",
  "/hero-slides", "/media-library", "/pages", "/news", "/events", "/gallery",
  "/announcements", "/academics", "/staff", "/enquiries", "/settings",
  "/navigation", "/outbox", "/users", "/audit", "/account", "/search?q=school",
];

async function status(url, headers = {}) {
  const res = await fetch(url, { headers, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
}

export async function runSmoke(session) {
  const failures = [];
  const check = (ok, label) => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}`);
    if (!ok) failures.push(label);
  };

  console.log("\nSIGNED OUT");
  for (const route of ["/", "/applications", "/users", "/audit"]) {
    const r = await status(BASE + route);
    check(r.status === 307 && r.location?.startsWith("/login"), `${route} -> ${r.status} ${r.location ?? ""}`);
  }
  check((await status(BASE + "/login")).status === 200, "/login -> 200");
  check((await status(BASE + "/applications/export")).status !== 200, "CSV export refuses without a session");
  check((await status(BASE + "/api/cron/mail")).status !== 200, "mail cron endpoint refuses without its bearer secret");
  check((await status(BASE + "/api/nav-counts")).status === 401, "sidebar counts refuse without a session");

  console.log("\nSIGNED IN AS SUPER_ADMIN");
  const headers = { cookie: `bass_session=${session}` };
  for (const route of ADMIN_ROUTES) {
    const { status: s } = await status(BASE + route, headers);
    check(s === 200, `${route} -> ${s}`);
  }

  const countsRes = await fetch(BASE + "/api/nav-counts", { headers });
  const counts = countsRes.ok ? await countsRes.json() : null;
  check(countsRes.status === 200 && counts && ["/applications", "/documents", "/enquiries", "/outbox"].every((k) => Number.isInteger(counts[k])), `sidebar counts for a super administrator -> ${countsRes.status} ${JSON.stringify(counts)}`);

  console.log("\nHEADERS");
  const res = await fetch(BASE + "/login");
  check(res.headers.get("x-robots-tag")?.includes("noindex"), "X-Robots-Tag noindex present");
  check(res.headers.get("strict-transport-security")?.includes("max-age"), "HSTS present");
  check(res.headers.get("x-content-type-options") === "nosniff", "nosniff present");

  return failures;
}
