/**
 * Content-type detection by magic bytes.
 *
 * A browser-supplied `Content-Type` and a file extension are both attacker
 * controlled, so neither is trusted. Uploads are matched against an allow-list
 * of signatures and anything unrecognised is rejected.
 *
 * SVG is deliberately absent: it is an XML document that can carry script, and
 * serving one from our own origin would be a stored-XSS vector.
 */

export type DetectedType = {
  mimeType: string;
  extension: string;
};

const JPEG = { mimeType: "image/jpeg", extension: "jpg" } as const;
const PNG = { mimeType: "image/png", extension: "png" } as const;
const WEBP = { mimeType: "image/webp", extension: "webp" } as const;
const GIF = { mimeType: "image/gif", extension: "gif" } as const;
const PDF = { mimeType: "application/pdf", extension: "pdf" } as const;

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, index) => buffer[offset + index] === byte);
}

function asciiAt(buffer: Buffer, offset: number, length: number): string {
  if (buffer.length < offset + length) return "";
  return buffer.subarray(offset, offset + length).toString("ascii");
}

/** Returns the detected type, or null when the signature is not allow-listed. */
export function detectFileType(buffer: Buffer): DetectedType | null {
  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return JPEG;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return PNG;
  }

  // WebP: "RIFF" .... "WEBP"
  if (asciiAt(buffer, 0, 4) === "RIFF" && asciiAt(buffer, 8, 4) === "WEBP") {
    return WEBP;
  }

  // GIF: "GIF87a" or "GIF89a"
  const gifHeader = asciiAt(buffer, 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return GIF;

  // PDF: "%PDF-"
  if (asciiAt(buffer, 0, 5) === "%PDF-") return PDF;

  return null;
}

export const IMAGE_MIME_TYPES = [
  JPEG.mimeType,
  PNG.mimeType,
  WEBP.mimeType,
  GIF.mimeType,
] as const;

export const DOCUMENT_MIME_TYPES = [PDF.mimeType] as const;

export function isImageMimeType(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export type FileValidationResult =
  | { ok: true; detected: DetectedType }
  | { ok: false; reason: string };

/**
 * Validates an upload against its real signature, an allow-list and a size cap.
 * `declaredMimeType` is only ever used to produce a clearer error message — it
 * is never trusted for the decision itself.
 */
export function validateUpload({
  buffer,
  allowedMimeTypes,
  maxSizeBytes,
  declaredMimeType,
}: {
  buffer: Buffer;
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
  declaredMimeType?: string;
}): FileValidationResult {
  if (buffer.length === 0) {
    return { ok: false, reason: "The file is empty." };
  }

  if (buffer.length > maxSizeBytes) {
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: `The file is larger than the ${limitMb} MB limit.`,
    };
  }

  const detected = detectFileType(buffer);
  if (!detected) {
    return {
      ok: false,
      reason: "Unsupported file type. Upload a JPG, PNG, WebP, GIF or PDF.",
    };
  }

  if (!allowedMimeTypes.includes(detected.mimeType)) {
    return {
      ok: false,
      reason:
        declaredMimeType && declaredMimeType !== detected.mimeType
          ? `This file is actually ${detected.mimeType}, which is not accepted here.`
          : `${detected.mimeType} files are not accepted here.`,
    };
  }

  return { ok: true, detected };
}
