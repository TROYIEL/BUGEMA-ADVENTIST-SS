import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { listImageChoices } from "@bass/core/media-library";
import { getDepartment, listStaffChoices } from "@bass/core/school-admin";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { DepartmentForm } from "@/components/school/forms";

import { deleteDepartmentAction, saveDepartmentAction } from "../../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getDepartment(id);
  return { title: row ? `Edit: ${row.name}` : "Department" };
}

export default async function EditDepartmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePagePermission("academics:write");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [row, choices, staff] = await Promise.all([getDepartment(id), listImageChoices(), listStaffChoices()]);
  if (!row) notFound();
  return (
    <EditorShell
      crumbs={[{ label: "Academics", href: "/academics" }, { label: row.name }]}
      title={row.name}
      saved={saved === "1"}
      viewHref={row.status === ContentStatus.PUBLISHED ? siteUrl(`/academics/departments/${row.slug}`) : null}
      deleteAction={deleteDepartmentAction}
      deleteId={row.id}
      deleteNote={`Removes the department and its page. Its ${row._count.subjects} ${row._count.subjects === 1 ? "subject stays" : "subjects stay"}, without a department.`}
    >
      <DepartmentForm
        action={saveDepartmentAction.bind(null, row.id)}
        values={{ title: row.name, slug: row.slug, description: row.description ?? "", body: row.body ?? "", imageId: row.imageId ?? "", headId: row.headId ?? "", status: row.status }}
        choices={choices}
        staff={staff}
        isNew={false}
      />
    </EditorShell>
  );
}
