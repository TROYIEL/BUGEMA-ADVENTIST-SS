import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sharp from "sharp";

import { createBlurPlaceholder, processImage, processUploadedDocument } from "./media";

/** A JPEG carrying EXIF metadata, standing in for a phone photograph. */
async function jpegWithExif(width = 3200, height = 2000): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 60, b: 110 },
    },
  })
    .withExif({
      IFD0: {
        Copyright: "BASS test fixture",
        Software: "sharp-test",
      },
      // sharp keys the GPS IFD as IFD3. These are exactly the tags that leak
      // a child's location if a phone photograph is served unprocessed.
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLongitudeRef: "E",
      },
    })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("strips EXIF, including GPS, from the stored file", async () => {
    const original = await jpegWithExif(800, 600);

    // Guard the fixture itself: if sharp stopped writing EXIF this test would
    // pass vacuously.
    const originalMeta = await sharp(original).metadata();
    assert.ok(originalMeta.exif, "fixture must actually carry EXIF to be meaningful");

    const processed = await processImage(original);
    const processedMeta = await sharp(processed.buffer).metadata();

    assert.equal(processedMeta.exif, undefined, "EXIF must not survive processing");
    assert.equal(processedMeta.xmp, undefined, "XMP must not survive processing");
  });

  it("bounds the longest edge and preserves aspect ratio", async () => {
    const original = await jpegWithExif(3200, 2000);
    const processed = await processImage(original, { maxDimension: 1200 });

    assert.equal(processed.width, 1200);
    assert.equal(processed.height, 750, "3200x2000 scaled to 1200 wide is 750 tall");
  });

  it("does not enlarge an image smaller than the bound", async () => {
    const original = await jpegWithExif(400, 300);
    const processed = await processImage(original, { maxDimension: 2400 });

    assert.equal(processed.width, 400);
    assert.equal(processed.height, 300);
  });

  it("handles portrait orientation without swapping the bound", async () => {
    const original = await jpegWithExif(1000, 2500);
    const processed = await processImage(original, { maxDimension: 1000 });

    assert.equal(processed.height, 1000);
    assert.equal(processed.width, 400);
  });

  it("converts to WebP by default and reports it honestly", async () => {
    const processed = await processImage(await jpegWithExif(600, 400));

    assert.equal(processed.mimeType, "image/webp");
    assert.equal(processed.extension, "webp");
    const meta = await sharp(processed.buffer).metadata();
    assert.equal(meta.format, "webp");
  });

  it("produces an inline blur placeholder", async () => {
    const processed = await processImage(await jpegWithExif(600, 400));

    assert.match(processed.blurDataUrl, /^data:image\/webp;base64,/);
    // Must be small enough to inline in HTML without bloating the payload.
    assert.ok(
      processed.blurDataUrl.length < 2000,
      `blur placeholder too large: ${processed.blurDataUrl.length} chars`,
    );
  });

  it("rejects a corrupt image rather than storing it", async () => {
    await assert.rejects(() => processImage(Buffer.from("not an image at all")));
  });
});

describe("createBlurPlaceholder", () => {
  it("returns a data URL for a valid image", async () => {
    const url = await createBlurPlaceholder(await jpegWithExif(500, 500));
    assert.match(url, /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
  });
});

describe("processUploadedDocument", () => {
  it("passes PDFs through byte-identical", async () => {
    const pdf = Buffer.from("%PDF-1.7\nfake pdf body\n%%EOF");
    const result = await processUploadedDocument(pdf, "application/pdf");

    assert.ok(result.buffer.equals(pdf), "PDF bytes must not be rewritten");
    assert.equal(result.width, null);
    assert.equal(result.height, null);
  });

  it("still strips metadata from scanned image documents", async () => {
    const original = await jpegWithExif(1200, 900);
    const result = await processUploadedDocument(original, "image/jpeg");

    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.exif, undefined, "scanned documents must also be stripped");
    assert.equal(result.width, 1200, "document resolution must be preserved");
    assert.equal(result.height, 900);
  });
});
