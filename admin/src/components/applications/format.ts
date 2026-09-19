/** Dates and sizes as staff read them, in the school's time zone. */

const KAMPALA = "Africa/Kampala";

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: KAMPALA,
  }).format(date);
}

export function formatDay(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: KAMPALA,
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function fullName(row: {
  firstName: string | null;
  middleName?: string | null;
  lastName: string | null;
}): string {
  return [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ") || "Unnamed";
}
