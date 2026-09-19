import "server-only";

import sharp from "sharp";

import { isImageMimeType } from "./mime";

/**
 * Image ingestion pipeline.
 *
 * Every uploaded image is re-encoded rather than stored as received. That:
 *  - strips EXIF, which on phone photographs routinely carries GPS
 *    coordinates. These are pictures of schoolchildren, so location metadata
 *    must not survive into a publicly served file.
 *  - removes any trailing payload smuggled after the image data, since the
 *    output is written from decoded pixels.
 *  - bounds the dimensions, so a decompression-bomb upload cannot be served.
 */

export type ProcessedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  blurDataUrl: string;
};

export type ProcessImageOptions = {
  /** Longest edge in pixels; larger images are scaled down. */
  maxDimension?: number;
  quality?: number;
  /** Keep the original encoding instead of converting to WebP. */
  preserveFormat?: boolean;
};

/** Refuse absurd pixel counts before allocating a full decode buffer. */
const MAX_INPUT_PIXELS = 80_000_000;

export async function processImage(
  input: Buffer,
  options: ProcessImageOptions = {},
): Promise<ProcessedImage> {
  const { maxDimension = 2400, quality = 82, preserveFormat = false } = options;

  const pipeline = sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error",
  });

  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read the image dimensions.");
  }

  // `rotate()` with no argument bakes in EXIF orientation before the metadata
  // is discarded, so portrait photographs do not come out sideways.
  let transform = sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error",
  }).rotate();

  const longestEdge = Math.max(metadata.width, metadata.height);
  if (longestEdge > maxDimension) {
    transform = transform.resize({
      width: metadata.width >= metadata.height ? maxDimension : undefined,
      height: metadata.height > metadata.width ? maxDimension : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const useOriginalFormat =
    preserveFormat && metadata.format === "png" ? "png" : preserveFormat ? "jpeg" : "webp";

  const output =
    useOriginalFormat === "webp"
      ? transform.webp({ quality })
      : useOriginalFormat === "png"
        ? transform.png({ compressionLevel: 9 })
        : transform.jpeg({ quality, mozjpeg: true });

  const { data, info } = await output.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: `image/${useOriginalFormat}`,
    extension: useOriginalFormat === "jpeg" ? "jpg" : useOriginalFormat,
    width: info.width,
    height: info.height,
    blurDataUrl: await createBlurPlaceholder(input),
  };
}

/**
 * A 16px-wide WebP inlined as a data URL. Small enough to sit in the database
 * row and in the HTML payload without a second request.
 */
export async function createBlurPlaceholder(input: Buffer): Promise<string> {
  const blur = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();

  return `data:image/webp;base64,${blur.toString("base64")}`;
}

/**
 * Applicant documents keep their original format and resolution: a scanned
 * report card has to stay legible, and a PDF must remain byte-identical so it
 * can be treated as the document that was actually submitted. Images still get
 * their metadata stripped.
 */
export async function processUploadedDocument(
  input: Buffer,
  mimeType: string,
): Promise<{
  buffer: Buffer;
  width: number | null;
  height: number | null;
}> {
  if (!isImageMimeType(mimeType)) {
    return { buffer: input, width: null, height: null };
  }

  const processed = await processImage(input, {
    maxDimension: 3000,
    quality: 88,
    preserveFormat: true,
  });

  return {
    buffer: processed.buffer,
    width: processed.width,
    height: processed.height,
  };
}
