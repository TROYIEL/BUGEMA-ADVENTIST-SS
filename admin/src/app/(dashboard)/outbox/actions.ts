"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/dal";
import { recordAudit } from "@/lib/audit";
import { isMailDeliveryConfigured } from "@/lib/mail";
import { getOutboxMessage, isResendable, resendAllOutbox, resendOutboxMessage } from "@/lib/mail-admin";

import { text } from "@/lib/forms";

function refresh() {
  revalidatePath("/outbox");
  revalidatePath("/");
}

/**
 * Tries one message again. The outcome lands on the row itself (status,
 * attempts, last error) and is echoed in a notice on the page the button
 * was pressed from.
 */
export async function resendMessageAction(formData: FormData): Promise<void> {
  const user = await requirePermission("settings:write");
  const id = text(formData, "id");
  const back = text(formData, "back") === "detail" ? `/outbox/${id}` : "/outbox";

  const row = await getOutboxMessage(id);
  if (!row) redirect("/outbox");
  if (!isResendable(row.status)) redirect(back as never);
  if (!isMailDeliveryConfigured()) redirect(`${back}?notice=unconfigured` as never);

  const result = await resendOutboxMessage(id);
  await recordAudit({
    actorUserId: user.id,
    action: "resent",
    entityType: "email_outbox",
    entityId: id,
    note: row.subject,
    newValue: { sent: result.sent, failed: result.failed },
  });
  refresh();
  revalidatePath(`/outbox/${id}`);
  redirect(`${back}?notice=${result.sent > 0 ? "sent" : result.failed > 0 ? "failed" : "skipped"}` as never);
}

/** Tries every queued and failed message again. */
export async function resendAllAction(): Promise<void> {
  const user = await requirePermission("settings:write");
  if (!isMailDeliveryConfigured()) redirect("/outbox?notice=unconfigured");

  const result = await resendAllOutbox();
  await recordAudit({
    actorUserId: user.id,
    action: "resent",
    entityType: "email_outbox",
    note: `Retried the outbox: ${result.sent} sent, ${result.failed} failed`,
    newValue: { attempted: result.attempted, sent: result.sent, failed: result.failed },
  });
  refresh();
  redirect(`/outbox?notice=flushed&sent=${result.sent}&failed=${result.failed}`);
}
