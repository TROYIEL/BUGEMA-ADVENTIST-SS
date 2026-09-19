import type { Metadata } from "next";

import { requirePagePermission } from "@bass/auth/dal";
import { listImageChoices } from "@bass/core/media-library";
import { listStaffChoices } from "@bass/core/school-admin";

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
