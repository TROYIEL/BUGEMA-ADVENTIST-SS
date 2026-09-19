import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { listImageChoices } from "@/lib/media-library";

import { EditorShell } from "@/components/content/editor-shell";
import { ProgramForm } from "@/components/school/forms";

import { saveProgramAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New programme" };

export default async function NewProgramFormPage() {
  await requirePagePermission("academics:write");
  const choices = await listImageChoices();
  return (
    <EditorShell crumbs={[{ label: "Academics", href: "/academics" }, { label: "New programme" }]} title="New programme">
      <ProgramForm action={saveProgramAction.bind(null, null)} values={{ title: "", slug: "", level: "BOTH", summary: "", body: "", imageId: "", status: "DRAFT" }} choices={choices} isNew />
    </EditorShell>
  );
}
