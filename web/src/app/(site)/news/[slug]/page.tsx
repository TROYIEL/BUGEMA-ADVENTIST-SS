import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsCard } from "@/components/cards/content-cards";
import { MediaImage } from "@/components/media-image";
import { PageHeader } from "@/components/site/page-header";
import { RichText } from "@bass/ui/rich-text";
import { MEDIA_SELECT, formatDate, publishedFilter } from "@bass/core/content";
import { db } from "@bass/db";
import { richTextToPlainText, truncate } from "@bass/core/sanitize";

export const dynamic = "force-dynamic";

async function getArticle(slug: string) {
  return db.newsArticle.findFirst({
    where: { slug, ...publishedFilter() },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      category: true,
      publishedAt: true,
      seoTitle: true,
      seoDescription: true,
      author: { select: { name: true } },
      featuredImage: { select: MEDIA_SELECT },
    },
  });
}

export async function generateMetadata(
  props: PageProps<"/news/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getArticle(slug);
  if (!article) return {};

  const description =
    article.seoDescription ??
    article.excerpt ??
    truncate(richTextToPlainText(article.body), 155);

  return {
    title: article.seoTitle ?? article.title,
    ...(description ? { description } : {}),
    alternates: { canonical: `/news/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      ...(description ? { description } : {}),
      ...(article.publishedAt
        ? { publishedTime: article.publishedAt.toISOString() }
        : {}),
      ...(article.featuredImage
        ? { images: [{ url: `/media/${article.featuredImage.storageKey}` }] }
        : {}),
    },
  };
}

export default async function NewsArticlePage(
  props: PageProps<"/news/[slug]">,
) {
  const { slug } = await props.params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const related = await db.newsArticle.findMany({
    where: { ...publishedFilter(), NOT: { id: article.id } },
    orderBy: [{ publishedAt: "desc" }],
    take: 3,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      category: true,
      publishedAt: true,
      featuredImage: { select: MEDIA_SELECT },
    },
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={article.title}
        eyebrow={article.category}
        crumbs={[{ label: "News", href: "/news" }, { label: article.title }]}
        size="compact"
      />

      <article className="container-page py-12 md:py-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
          {article.publishedAt ? (
            <time dateTime={article.publishedAt.toISOString()}>
              {formatDate(article.publishedAt)}
            </time>
          ) : null}
          {article.author?.name ? <span>By {article.author.name}</span> : null}
        </div>

        {article.featuredImage ? (
          <MediaImage
            asset={article.featuredImage}
            sizes="(min-width: 1024px) 70vw, 100vw"
            priority
            className="mt-8 aspect-[16/9] w-full object-cover"
          />
        ) : null}

        {article.excerpt ? (
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-navy-800">
            {article.excerpt}
          </p>
        ) : null}

        <div className="mt-6">
          <RichText html={article.body} />
        </div>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-line bg-surface-sunken py-14">
          <div className="container-page">
            <h2 className="font-serif text-2xl text-navy-900">More news</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.id}>
                  <NewsCard
                    article={item}
                    sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
