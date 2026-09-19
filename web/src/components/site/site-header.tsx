import { NavigationMenu } from "@/generated/prisma/enums";
import { formatDate, getLatestNews } from "@/lib/content";
import { getNavigation } from "@/lib/navigation";
import { getSiteSettings, readSetting } from "@/lib/settings";

import { SiteNav, type MenuArticle } from "@/components/site/site-nav";
import type { MediaImageAsset } from "@/components/media-image";

/**
 * Server wrapper: resolves navigation, branding and the handful of articles
 * the mega-menu features, then hands them to the client component that owns
 * the menu interactions.
 *
 * Dates are formatted here rather than in the client component: `formatDate`
 * lives in a server-only module, and formatting on the server also avoids the
 * locale mismatch that causes hydration warnings.
 */
export async function SiteHeader({ logo }: { logo: MediaImageAsset | null }) {
  const [items, settings, latest] = await Promise.all([
    getNavigation(NavigationMenu.HEADER),
    getSiteSettings(),
    getLatestNews(2),
  ]);


  const schoolName =
    readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";

  const featuredNews: MenuArticle[] = latest.map((article) => ({
    slug: article.slug,
    title: article.title,
    category: article.category,
    dateLabel: article.publishedAt ? formatDate(article.publishedAt) : null,
    image: article.featuredImage,
  }));

  return (
    <SiteNav
      items={items}
      schoolName={schoolName}
      logo={logo}
      featuredNews={featuredNews}
    />
  );
}
