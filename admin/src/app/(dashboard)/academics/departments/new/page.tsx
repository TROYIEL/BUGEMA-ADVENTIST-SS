import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { listImageChoices } from "@/lib/media-library";
import { listStaffChoices } from "@/lib/school-admin";

import { EditorShell } from "@/components/content/editor-shell";
import { DepartmentForm } from "@/components/school/forms";

import { saveDepartmentAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New department" };

export default async function NewDepartmentFormPage() {
  await requirePagePermission("academics:write");
  const [choices, staff] = await Promise.all([listImageChoices(), listStaffChoices()]);
  return (
    <EditorShell crumbs={[{ label: "Academics", href: "/academics" }, { label: "New department" }]} title="New department">
      <DepartmentForm action={saveDepartmentAction.bind(null, null)} values={{ title: "", slug: "", description: "", body: "", imageId: "", headId: "", status: "DRAFT" }} choices={choices} staff={staff} isNew />
    </EditorShell>
  );
}
