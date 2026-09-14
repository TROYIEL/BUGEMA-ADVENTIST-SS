import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { richTextToParagraphs, sanitizeRichText } from "./sanitize";

describe("sanitizeRichText", () => {
  it("keeps the editor's vocabulary and drops script", () => {
    const html = '<h2>Title</h2><p>Hello <strong>there</strong> <a href="/about">link</a></p><script>alert(1)</script>';
    assert.equal(sanitizeRichText(html), '<h2>Title</h2><p>Hello <strong>there</strong> <a href="/about">link</a></p>');
  });

  it("turns browser editing tags into their semantic equivalents", () => {
    assert.equal(sanitizeRichText("<div>One <b>two</b> <i>three</i></div>"), "<p>One <strong>two</strong> <em>three</em></p>");
  });

  it("makes external links safe and leaves internal ones alone", () => {
    assert.equal(
      sanitizeRichText('<a href="https://example.org">out</a> <a href="/news">in</a>'),
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">out</a> <a href="/news">in</a>',
    );
  });

  it("refuses javascript: and data: schemes", () => {
    assert.equal(sanitizeRichText('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
    assert.equal(sanitizeRichText('<img src="data:image/svg+xml;base64,AAAA">'), "<img loading=\"lazy\" />");
  });
});

describe("richTextToParagraphs", () => {
  it("splits on block boundaries and collapses whitespace", () => {
    assert.deepEqual(richTextToParagraphs("<p>One\n two</p><p>  Three </p><br>Four"), ["One two", "Three", "Four"]);
  });
});
