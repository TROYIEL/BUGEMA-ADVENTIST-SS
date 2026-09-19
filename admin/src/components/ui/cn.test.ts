import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cn } from "./cn";

/**
 * Regression guard.
 *
 * tailwind-merge only knows the font sizes it ships with. The custom
 * `--text-display-*` sizes declared in globals.css have to be registered, or
 * tailwind-merge treats `text-display-md` as a text COLOUR and strips any real
 * colour merged alongside it — which is how a page heading once ended up navy
 * on a navy band, invisible.
 *
 * If someone adds a new display size to globals.css without adding it to
 * cn.ts, these fail.
 */
describe("cn", () => {
  const DISPLAY_SIZES = [
    "text-display-sm",
    "text-display-md",
    "text-display-lg",
    "text-display-xl",
  ];

  it("keeps a text colour alongside every custom display size", () => {
    for (const size of DISPLAY_SIZES) {
      const result = cn("text-white", size);
      assert.ok(
        result.includes("text-white"),
        `"${size}" stripped the text colour: got "${result}"`,
      );
      assert.ok(result.includes(size), `"${size}" was dropped: got "${result}"`);
    }
  });

  it("keeps a colour when responsive display sizes are merged in", () => {
    const result = cn("font-serif text-white", "text-display-sm md:text-display-md");
    assert.ok(result.includes("text-white"));
    assert.ok(result.includes("font-serif"));
    assert.ok(result.includes("md:text-display-md"));
  });

  it("still lets a later display size replace an earlier one", () => {
    assert.equal(cn("text-display-sm", "text-display-md"), "text-display-md");
  });

  it("still lets a later colour replace an earlier one", () => {
    assert.equal(cn("text-white", "text-gold-400"), "text-gold-400");
  });

  it("leaves built-in font sizes behaving as before", () => {
    assert.equal(cn("text-sm", "text-lg"), "text-lg");
    assert.equal(cn("text-navy-900", "text-2xl"), "text-navy-900 text-2xl");
  });

  it("merges conditional and falsy values", () => {
    assert.equal(cn("p-2", false, null, undefined, "p-4"), "p-4");
  });
});
