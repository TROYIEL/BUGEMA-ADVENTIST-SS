import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentPending } from "@/components/site/content-pending";
import { PageHeader } from "@/components/site/page-header";
import type { Crumb } from "@bass/ui/breadcrumbs";
import { RichText } from "@bass/ui/rich-text";
import { getPageBySlug, publishedFilter } from "@bass/core/content";
import { db } from "@bass/db";
import { richTextToPlainText, truncate } from "@bass/core/sanitize";

/**
 * Generic renderer for CMS-authored pages.
 *
 * Handles every page whose slug has no bespoke route — /about, /about/history,
 * /policies/privacy and so on. Next.js resolves static routes before dynamic
 * ones, so a purpose-built page like /news always wins over this catch-all.
 */
export const dynamic = "force-dynamic";

/** Builds the trail from ancestor slugs, using their real page titles. */
async function buildCrumbs(segments: string[]): Promise<Crumb[]> {
  if (segments.length <= 1) return [];

  const ancestorSlugs = segments
    .slice(0, -1)
    .map((_, index) => segments.slice(0, index + 1).join("/"));

  const ancestors = await db.page.findMany({
    where: { slug: { in: ancestorSlugs }, ...publishedFilter() },
    select: { slug: true, title: true },
  });

  const bySlug = new Map(ancestors.map((page) => [page.slug, page.title]));

  return ancestorSlugs
    .filter((slug) => bySlug.has(slug))
    .map((slug) => ({ label: bySlug.get(slug)!, href: `/${slug}` }));
}

export async function generateMetadata(
  props: PageProps<"/[...slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPageBySlug(slug.join("/"));

  if (!page) return {};

  const description =
    page.seoDescription ? page.seoDescription : 
    page.subtitle || truncate(richTextToPlainText(page.body), 155) ||
    undefined;

  return {
    title: page.seoTitle ?? page.title,
    ...(description ? { description } : {}),
    alternates: { canonical: page.canonicalUrl ?? `/${page.slug}` },
    ...(page.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      title: page.seoTitle ?? page.title,
      ...(description ? { description } : {}),
      ...(page.ogImage
        ? { images: [{ url: `/media/${page.ogImage.storageKey}` }] }
        : {}),
    },
  };
}

export default async function CmsPage(props: PageProps<"/[...slug]">) {
  const { slug } = await props.params;
  const path = slug.join("/");
  const page = await getPageBySlug(path);

  if (!page) notFound();

  const crumbs = [
    ...(await buildCrumbs(slug)),
    { label: page.title },
  ];

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader title={page.title} subtitle={page.subtitle} crumbs={crumbs} />

      <div className="container-page py-14 md:py-16">
        {page.body ? (
          <RichText html={page.body} />
        ) : (
          <ContentPending what={`Information about ${page.title.toLowerCase()}`} />
        )}
      </div>
    </main>
  );
}
