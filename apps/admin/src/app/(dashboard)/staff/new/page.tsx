import type { Metadata } from "next";

import { requirePagePermission } from "@bass/auth/dal";
import { listImageChoices } from "@bass/core/media-library";

import { EditorShell } from "@/components/content/editor-shell";
import { StaffForm } from "@/components/school/forms";

import { saveStaffAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New staff profile" };

export default async function NewStaffPage() {
  await requirePagePermission("staff:write");
  const choices = await listImageChoices();
  return (
    <EditorShell crumbs={[{ label: "Staff", href: "/staff" }, { label: "New profile" }]} title="New profile">
      <StaffForm
        action={saveStaffAction.bind(null, null)}
        values={{ name: "", position: "", department: "", bio: "", email: "", phone: "", photoId: "", isVisible: true, isLeadership: false }}
        choices={choices}
        isNew
      />
    </EditorShell>
  );
}
