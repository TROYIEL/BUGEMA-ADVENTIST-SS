import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { listNewsCategories } from "@/lib/content-admin";
import { listImageChoices } from "@/lib/media-library";

import { EditorShell } from "@/components/content/editor-shell";
import { NewsForm } from "@/components/content/forms";

import { saveNewsAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New story" };

export default async function NewNewsPage() {
  await requirePagePermission("content:write");
  const [choices, categories] = await Promise.all([listImageChoices(), listNewsCategories()]);
  return (
    <EditorShell crumbs={[{ label: "News", href: "/news" }, { label: "New story" }]} title="New story">
      <NewsForm
        action={saveNewsAction.bind(null, null)}
        values={{ title: "", slug: "", excerpt: "", body: "", category: "", status: "DRAFT", isFeatured: false, publishedAt: "", seoTitle: "", seoDescription: "", featuredImageId: "" }}
        choices={choices}
        categories={categories}
        isNew
      />
    </EditorShell>
  );
}
