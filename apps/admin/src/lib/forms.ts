import type { z } from "zod";

/**
 * Helpers shared by the Server Actions behind the content editors: reading
 * a form, turning date inputs into Dates, and reporting Zod issues per field.
 */

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back on a rejected save: React resets a form after any action. */
  values?: Record<string, string | boolean | string[]>;
};

export function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function flag(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export function firstIssues(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/** "YYYY-MM-DD" as UTC midnight, the convention the public site formats with. */
export function dateFromInput(value: string): Date | null | undefined {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** "YYYY-MM-DDTHH:MM" from a datetime-local input, read as Kampala time. */
export function dateTimeFromInput(value: string): Date | null | undefined {
  if (!value) return null;
  const date = new Date(`${value}:00+03:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function toDateTimeInput(date: Date | null | undefined): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
