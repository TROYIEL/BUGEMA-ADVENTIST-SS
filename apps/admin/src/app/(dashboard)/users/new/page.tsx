import type { Metadata } from "next";

import { requirePagePermission } from "@bass/auth/dal";
import { UserRole } from "@bass/db/enums";

import { EditorShell } from "@/components/content/editor-shell";
import { UserForm } from "@/components/settings/user-forms";

import { createUserAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New account" };

export default async function NewUserPage() {
  await requirePagePermission("users:write");
  return (
    <EditorShell crumbs={[{ label: "Users", href: "/users" }, { label: "New account" }]} title="New account">
      <UserForm action={createUserAction} values={{ name: "", email: "", role: UserRole.STAFF }} isNew isSelf={false} />
    </EditorShell>
  );
}
