import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { ContentStatus } from "@/generated/prisma/enums";
import { getPage } from "@/lib/content-admin";
import { listImageChoices } from "@/lib/media-library";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { PageForm } from "@/components/content/forms";
import { toDateTimeInput } from "@/lib/forms";

import { deletePageAction, savePageAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const page = await getPage(id);
  return { title: page ? `Edit: ${page.title}` : "Page" };
}

export default async function EditPagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; locked?: string }> }) {
  await requirePagePermission("content:write");
  const [{ id }, { saved, locked }] = await Promise.all([params, searchParams]);
  const [page, choices] = await Promise.all([getPage(id), listImageChoices()]);
  if (!page) notFound();

  return (
    <EditorShell
      crumbs={[{ label: "Pages", href: "/pages" }, { label: page.title }]}
      title={page.title}
      saved={saved === "1"}
      locked={locked === "1"}
      viewHref={page.status === ContentStatus.PUBLISHED ? siteUrl(`/${page.slug}`) : null}
      deleteAction={deletePageAction}
      deleteId={page.id}
      deleteNote="Removes the page and its address. Links to it from elsewhere will break."
      deleteDisabledReason={page.isSystem ? "This page is part of the site's structure; unpublish it instead." : null}
    >
      <PageForm
        action={savePageAction.bind(null, page.id)}
        values={{
          title: page.title,
          slug: page.slug,
          subtitle: page.subtitle ?? "",
          body: page.body ?? "",
          status: page.status,
          publishedAt: toDateTimeInput(page.publishedAt),
          seoTitle: page.seoTitle ?? "",
          seoDescription: page.seoDescription ?? "",
          ogImageId: page.ogImageId ?? "",
          canonicalUrl: page.canonicalUrl ?? "",
          noindex: page.noindex,
        }}
        choices={choices}
        isNew={false}
        isSystem={page.isSystem}
      />
    </EditorShell>
  );
}
