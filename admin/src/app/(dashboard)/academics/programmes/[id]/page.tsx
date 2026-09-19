import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { listImageChoices } from "@bass/core/media-library";
import { getProgram } from "@bass/core/school-admin";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { ProgramForm } from "@/components/school/forms";

import { deleteProgramAction, saveProgramAction } from "../../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getProgram(id);
  return { title: row ? `Edit: ${row.title}` : "Programme" };
}

export default async function EditProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePagePermission("academics:write");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [row, choices] = await Promise.all([getProgram(id), listImageChoices()]);
  if (!row) notFound();
  return (
    <EditorShell
      crumbs={[{ label: "Academics", href: "/academics" }, { label: row.title }]}
      title={row.title}
      saved={saved === "1"}
      viewHref={row.status === ContentStatus.PUBLISHED ? siteUrl(`/academics/programmes/${row.slug}`) : null}
      deleteAction={deleteProgramAction}
      deleteId={row.id}
      deleteNote="Removes the programme and its page."
    >
      <ProgramForm
        action={saveProgramAction.bind(null, row.id)}
        values={{ title: row.title, slug: row.slug, level: row.level, summary: row.summary ?? "", body: row.body ?? "", imageId: row.imageId ?? "", status: row.status }}
        choices={choices}
        isNew={false}
      />
    </EditorShell>
  );
}
