import { ApplicationStep, FormFieldType } from "@/generated/prisma/enums";

import type { FieldOption } from "./application-schemas";

/**
 * The parts of the admissions configuration that are plain data and pure
 * functions — safe for client components, which the server-only module that
 * talks to the database is not.
 */

/** The formats a document type may accept, as offered to the administrator. */
export const DOCUMENT_FORMATS = [
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WebP" },
  { value: "application/pdf", label: "PDF" },
] as const;

/** A stable key from a label: "Church attended?" -> "church_attended". */
export function keyFromLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "question";
}

/**
 * Options are typed one per line. "value | Label" gives the two apart;
 * a plain line is both. Blank lines are ignored.
 */
export function parseOptionsText(text: string): FieldOption[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split("|").map((part) => part.trim());
      return { value: value!, label: label || value! };
    });
}

export function formatOptionsText(options: FieldOption[]): string {
  return options
    .map((option) => (option.label === option.value ? option.value : `${option.value} | ${option.label}`))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Labels shared by the admin pages
// ---------------------------------------------------------------------------

export const STEP_LABELS: Record<ApplicationStep, string> = {
  [ApplicationStep.APPLICANT]: "The applicant",
  [ApplicationStep.GUARDIAN]: "Parent or guardian",
  [ApplicationStep.ACADEMIC]: "Schooling so far",
  [ApplicationStep.ADDITIONAL]: "A few more questions",
  [ApplicationStep.DOCUMENTS]: "Documents (shown under extra questions)",
  [ApplicationStep.REVIEW]: "Review (shown under extra questions)",
};

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  [FormFieldType.TEXT]: "Short text",
  [FormFieldType.TEXTAREA]: "Long text",
  [FormFieldType.SELECT]: "Choose one (drop-down)",
  [FormFieldType.RADIO]: "Choose one (buttons)",
  [FormFieldType.MULTISELECT]: "Choose several",
  [FormFieldType.CHECKBOX]: "Tick box",
  [FormFieldType.DATE]: "Date",
  [FormFieldType.NUMBER]: "Number",
  [FormFieldType.EMAIL]: "Email address",
  [FormFieldType.PHONE]: "Telephone number",
};
