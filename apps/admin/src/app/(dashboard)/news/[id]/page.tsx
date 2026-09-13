import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { getNews, listNewsCategories } from "@bass/core/content-admin";
import { listImageChoices } from "@bass/core/media-library";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { NewsForm } from "@/components/content/forms";
import { toDateTimeInput } from "@/lib/forms";

import { deleteNewsAction, saveNewsAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = await getNews(id);
  return { title: story ? `Edit: ${story.title}` : "Story" };
}

export default async function EditNewsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePagePermission("content:write");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [story, choices, categories] = await Promise.all([getNews(id), listImageChoices(), listNewsCategories()]);
  if (!story) notFound();

  return (
    <EditorShell
      crumbs={[{ label: "News", href: "/news" }, { label: story.title }]}
      title={story.title}
      saved={saved === "1"}
      viewHref={story.status === ContentStatus.PUBLISHED ? siteUrl(`/news/${story.slug}`) : null}
      deleteAction={deleteNewsAction}
      deleteId={story.id}
      deleteNote="Removes the story from the website and from search."
    >
      <NewsForm
        action={saveNewsAction.bind(null, story.id)}
        values={{
          title: story.title,
          slug: story.slug,
          excerpt: story.excerpt ?? "",
          body: story.body ?? "",
          category: story.category ?? "",
          status: story.status,
          isFeatured: story.isFeatured,
          publishedAt: toDateTimeInput(story.publishedAt),
          seoTitle: story.seoTitle ?? "",
          seoDescription: story.seoDescription ?? "",
          featuredImageId: story.featuredImageId ?? "",
        }}
        choices={choices}
        categories={categories}
        isNew={false}
      />
    </EditorShell>
  );
}
