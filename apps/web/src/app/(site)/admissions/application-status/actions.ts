"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  getPortalApplicationId,
  grantPortalAccess,
  revokePortalAccess,
} from "@bass/auth/applicant";
import { getClientIp } from "@bass/auth/session";
import { lookupSchema } from "@bass/core/application-schemas";
import {
  canApplicantUpload,
  documentTypesFor,
  findSubmittedByLookup,
  getApplicationConfig,
  getPortalApplication,
  storeDocument,
} from "@bass/core/applications";
import { RATE_LIMITS, rateLimit } from "@bass/core/rate-limit";

import type { StepFormState } from "../apply/actions";

export type LookupState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof lookupSchema>, string>>;
  values?: Record<string, string>;
};

/**
 * Reference number, surname and date of birth. All three are checked together
 * in one query and the reply is the same whichever was wrong, so the form
 * cannot be used to confirm that a reference exists.
 */
export async function lookup(_previous: LookupState, formData: FormData): Promise<LookupState> {
  const raw = {
    referenceNumber: String(formData.get("referenceNumber") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
  };

  const parsed = lookupSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: LookupState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof fieldErrors;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, values: raw };
  }

  const ip = (await getClientIp()) ?? "unknown";
  const limit = await rateLimit({
    key: `application-lookup:${ip}`,
    ...RATE_LIMITS.applicationStatusLookup,
  });
  if (!limit.ok) {
    return {
      status: "error",
      message: "Too many attempts. Please wait a few minutes and try again.",
      values: raw,
    };
  }

  const application = await findSubmittedByLookup(parsed.data);
  if (!application) {
    return {
      status: "error",
      message:
        "We could not find an application with those details. Check the reference, the surname and the date of birth, exactly as they were entered on the form.",
      values: raw,
    };
  }

  await grantPortalAccess(application.id);
  redirect("/admissions/application-status");
}

export async function signOut(): Promise<void> {
  await revokePortalAccess();
  redirect("/admissions/application-status");
}

/**
 * A replacement or missing document, after submission. Allowed only where the
 * school has asked for it, or nothing has been uploaded for that type yet.
 */
export async function uploadPortalDocument(
  _previous: StepFormState,
  formData: FormData,
): Promise<StepFormState> {
  const applicationId = await getPortalApplicationId();
  if (!applicationId) redirect("/admissions/application-status");

  const [application, config] = await Promise.all([
    getPortalApplication(applicationId),
    getApplicationConfig(),
  ]);
  if (!application) redirect("/admissions/application-status");

  const documentTypeId = String(formData.get("documentTypeId") ?? "");
  const documentType = documentTypesFor(config, application.applicationClass?.level ?? null).find(
    (type) => type.id === documentTypeId,
  );
  if (!documentType) {
    return { status: "error", message: "This document is not part of the application." };
  }

  const existing = application.documents.find((doc) => doc.documentTypeId === documentType.id);
  if (!canApplicantUpload(application, existing ?? null)) {
    return {
      status: "error",
      message: "This document cannot be changed at the moment.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a file to upload." };
  }

  const ip = (await getClientIp()) ?? "unknown";
  const limit = await rateLimit({ key: `document-upload:${ip}`, ...RATE_LIMITS.documentUpload });
  if (!limit.ok) {
    return {
      status: "error",
      message: "Too many uploads in a short time. Please wait a little and try again.",
    };
  }

  const result = await storeDocument({ application, documentType, file });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  refresh();
  return { status: "success", message: `${documentType.name} uploaded. The school will review it.` };
}
