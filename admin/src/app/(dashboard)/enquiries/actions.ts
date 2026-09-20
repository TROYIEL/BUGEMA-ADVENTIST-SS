"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/dal";
import { EnquiryStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { isMailDeliveryConfigured } from "@/lib/mail";
import { REPLY_MAX_LENGTH, deleteEnquiry, getEnquiry, replyToEnquiry, setEnquiryStatus } from "@/lib/school-admin";

import { text, type FormState } from "@/lib/forms";

function refresh(id: string) {
  revalidatePath("/enquiries");
  revalidatePath(`/enquiries/${id}`);
  revalidatePath("/");
}

export async function setEnquiryStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("messages:write");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!(status in EnquiryStatus)) return;
  if (!(await getEnquiry(id))) redirect("/enquiries");
  await setEnquiryStatus(id, status as EnquiryStatus, user.id);
  await recordAudit({ actorUserId: user.id, action: "updated", entityType: "contact_enquiry", entityId: id, newValue: { status } });
  refresh(id);
}

export async function deleteEnquiryAction(formData: FormData): Promise<void> {
  const user = await requirePermission("messages:write");
  const id = text(formData, "id");
  const row = await getEnquiry(id);
  if (!row) redirect("/enquiries");
  await deleteEnquiry(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "contact_enquiry", entityId: id, note: row.subject });
  refresh(id);
  redirect("/enquiries?deleted=1");
}

/**
 * Sends a reply written on the enquiry page. The text is saved before the
 * email is attempted, so a mail failure loses nothing; the thread shows what
 * happened to the message either way.
 */
export async function replyToEnquiryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("messages:write");
  const id = text(formData, "id");
  const body = text(formData, "body").trim();

  if (!body) {
    return { status: "error", fieldErrors: { body: "Write a reply before sending." }, values: { body } };
  }
  if (body.length > REPLY_MAX_LENGTH) {
    return {
      status: "error",
      fieldErrors: { body: `Keep the reply under ${REPLY_MAX_LENGTH.toLocaleString("en-GB")} characters.` },
      values: { body },
    };
  }

  const result = await replyToEnquiry(id, body, user.id);
  if (!result) redirect("/enquiries");

  await recordAudit({
    actorUserId: user.id,
    action: "replied",
    entityType: "contact_enquiry",
    entityId: id,
    note: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    newValue: { delivered: result.delivered, outboxId: result.reply.outbox?.id ?? null },
  });
  refresh(id);

  return {
    status: "success",
    message: result.delivered
      ? "Reply sent."
      : isMailDeliveryConfigured()
        ? "Reply saved, but the mail server refused it — see the outbox for the reason. It will be retried."
        : "Reply saved and queued. No mail server is configured yet, so it will be sent once one is.",
  };
}
