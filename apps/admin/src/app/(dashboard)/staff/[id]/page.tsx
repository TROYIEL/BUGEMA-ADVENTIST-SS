import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@bass/auth/dal";
import { listImageChoices } from "@bass/core/media-library";
import { getStaff } from "@bass/core/school-admin";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { StaffForm } from "@/components/school/forms";

import { deleteStaffAction, saveStaffAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getStaff(id);
  return { title: row ? `Edit: ${row.name}` : "Staff profile" };
}

export default async function EditStaffPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePagePermission("staff:write");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [row, choices] = await Promise.all([getStaff(id), listImageChoices()]);
  if (!row) notFound();
  const links = [row._count.headedDepartments ? `heads ${row._count.headedDepartments} ${row._count.headedDepartments === 1 ? "department" : "departments"}` : null, row._count.taughtSubjects ? `leads ${row._count.taughtSubjects} ${row._count.taughtSubjects === 1 ? "subject" : "subjects"}` : null].filter(Boolean);
  return (
    <EditorShell
      crumbs={[{ label: "Staff", href: "/staff" }, { label: row.name }]}
      title={row.name}
      saved={saved === "1"}
      viewHref={row.isVisible ? siteUrl("/about/leadership") : null}
      deleteAction={deleteStaffAction}
      deleteId={row.id}
      deleteNote={links.length ? `This person ${links.join(" and ")}; those keep their rows without them.` : "Removes the profile from the website."}
    >
      <StaffForm
        action={saveStaffAction.bind(null, row.id)}
        values={{ name: row.name, position: row.position, department: row.department ?? "", bio: row.bio ?? "", email: row.email ?? "", phone: row.phone ?? "", photoId: row.photoId ?? "", isVisible: row.isVisible, isLeadership: row.isLeadership }}
        choices={choices}
        isNew={false}
      />
    </EditorShell>
  );
}
