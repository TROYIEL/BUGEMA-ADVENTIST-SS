/** Pure formatting helpers shared by server and client components. */

const ACCEPTED_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "application/pdf": "PDF",
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function acceptedSummary(mimeTypes: string[]): string {
  return mimeTypes.map((type) => ACCEPTED_LABELS[type] ?? type).join(", ");
}
