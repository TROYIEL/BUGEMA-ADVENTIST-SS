"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@bass/auth/dal";
import { EnquiryStatus } from "@bass/db/enums";
import { recordAudit } from "@bass/core/audit";
import { deleteEnquiry, getEnquiry, setEnquiryStatus } from "@bass/core/school-admin";

import { text } from "@/lib/forms";

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
