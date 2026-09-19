import puppeteer from "puppeteer-core";

/**
 * Launches the locally installed Chrome for end-to-end checks.
 *
 * Two things the defaults get wrong for this project:
 *
 *  - Headless Chrome reports no pointing device, so every Tailwind hover
 *    style — which sits inside `@media (hover: hover)` — is inert and a
 *    screenshot never shows one. The blink-settings force a fine, hover-capable
 *    pointer (HoverType kHoverHoverType = 2, PointerType kPointerFineType = 4).
 *  - `puppeteer-core` never downloads a browser; CHROME_PATH overrides the
 *    Linux default when the binary lives elsewhere.
 */
export async function launchBrowser() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--blink-settings=availableHoverTypes=2,primaryHoverType=2,availablePointerTypes=4,primaryPointerType=4",
    ],
  });
}

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3001";

export async function adminPage(browser, session, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (session) {
    await page.setCookie({ name: "bass_session", value: session, domain: new URL(BASE).hostname, path: "/" });
  }
  return page;
}
