import type { Metadata } from "next";

import { requirePagePermission } from "@bass/auth/dal";
import { listImageChoices } from "@bass/core/media-library";

import { EditorShell } from "@/components/content/editor-shell";
import { PageForm } from "@/components/content/forms";

import { savePageAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New page" };

export default async function NewPagePage() {
  await requirePagePermission("content:write");
  const choices = await listImageChoices();
  return (
    <EditorShell crumbs={[{ label: "Pages", href: "/pages" }, { label: "New page" }]} title="New page">
      <PageForm
        action={savePageAction.bind(null, null)}
        values={{ title: "", slug: "", subtitle: "", body: "", status: "DRAFT", publishedAt: "", seoTitle: "", seoDescription: "", ogImageId: "", canonicalUrl: "", noindex: false }}
        choices={choices}
        isNew
        isSystem={false}
      />
    </EditorShell>
  );
}
