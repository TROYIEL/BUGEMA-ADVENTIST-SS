import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { listImageChoices } from "@/lib/media-library";

import { EditorShell } from "@/components/content/editor-shell";
import { AlbumForm } from "@/components/content/forms";

import { saveAlbumAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New album" };

export default async function NewAlbumPage() {
  await requirePagePermission("content:write");
  const choices = await listImageChoices();
  return (
    <EditorShell crumbs={[{ label: "Gallery", href: "/gallery" }, { label: "New album" }]} title="New album">
      <p className="mb-4 text-sm text-ink-600">Create the album first; photographs are added on its page.</p>
      <AlbumForm
        action={saveAlbumAction.bind(null, null)}
        values={{ title: "", slug: "", description: "", category: "", status: "DRAFT", coverImageId: "" }}
        choices={choices}
        isNew
      />
    </EditorShell>
  );
}
