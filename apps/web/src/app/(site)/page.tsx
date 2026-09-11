import type { Metadata } from "next";

import { getHomeFeatures, getHomeHighlights, getHomeImages } from "@bass/core/home";
import { getPageBySlug } from "@bass/core/content";
import { getSiteSettings, readSetting } from "@bass/core/settings";
import { richTextToPlainText, truncate } from "@bass/core/sanitize";

import { Hero } from "@/components/sections/hero";
import {
  FeatureGrid,
  FeaturedStory,
  QuickActions,
  Statistics,
} from "@/components/sections/blocks";
import { AcademicProgramsSection } from "@/components/sections/collections";
import { LatestSection } from "@/components/sections/latest";

/**
 * Homepage.
 *
 * The sequence of bands below is FIXED IN CODE and is not editable from the
 * dashboard. What each band contains still comes from the database — settings,
 * feature cards, highlights, programmes, news and events — so the school can
 * change the content of the front page without a developer, while the layout
 * itself stays designed rather than assembled.
 *
 * Each band renders nothing when it has no content, so an empty database
 * produces a short, correct page rather than a row of blank cards.
 */
export const dynamic = "force-dynamic";

/** Fixed navigation shortcuts. Part of the layout, not editable content. */
const QUICK_ACTIONS = [
  { label: "Apply for admission", href: "/admissions/apply" },
  { label: "Entry requirements", href: "/admissions/requirements" },
  { label: "How to apply", href: "/admissions/how-to-apply" },
  { label: "Contact the school", href: "/contact" },
];

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const name =
    readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";
  const tagline = readSetting(settings, "school.tagline");

  return {
    // The homepage uses the bare school name rather than the title template,
    // which would otherwise repeat it twice.
    title: { absolute: tagline ? `${name} — ${tagline}` : name },
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [settings, images, features, highlights, aboutPage] = await Promise.all([
    getSiteSettings(),
    getHomeImages(),
    getHomeFeatures(),
    getHomeHighlights(),
    getPageBySlug("about"),
  ]);

  const schoolName =
    readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";

  // The featured band reuses the About page's own words rather than keeping a
  // second copy of them that could drift out of step.
  const aboutSummary = aboutPage
    ? (aboutPage.subtitle ?? truncate(richTextToPlainText(aboutPage.body), 260))
    : null;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <Hero
        title={schoolName}
        body={readSetting(settings, "school.tagline")}
        displayText={readSetting(settings, "school.motto")}
        phone={readSetting(settings, "contact.phone")}
        ctaLabel="Apply for admission"
        ctaHref="/admissions/apply"
        ctaSecondaryLabel="Explore BASS"
        ctaSecondaryHref="/about"
        image={images.hero}
        collage={images.collage}
      />

      <QuickActions title="Start your application" actions={QUICK_ACTIONS} />

      <FeatureGrid
        content={{
          eyebrow: "Why BASS",
          title: `Why choose ${schoolName}`,
        }}
        features={features.map((feature) => ({
          title: feature.title,
          body: feature.body,
          media: feature.media,
        }))}
      />

      <FeaturedStory
        content={{
          eyebrow: "About BASS",
          title: aboutPage?.title ?? `About ${schoolName}`,
          body: aboutSummary,
          ctaLabel: "More about the school",
          ctaHref: "/about",
          media: images.about,
        }}
      />

      <AcademicProgramsSection
        content={{
          eyebrow: "Academics",
          title: "What you can study",
          ctaLabel: "Explore academics",
          ctaHref: "/academics",
        }}
        limit={3}
      />

      <Statistics
        content={{ title: readSetting(settings, "school.tagline") ?? undefined }}
        stats={highlights.map((highlight) => ({
          value: highlight.value,
          label: highlight.label,
          caption: highlight.caption ?? undefined,
          media: highlight.media,
        }))}
      />

      <LatestSection
        content={{ title: "What's the latest at BASS?" }}
        limit={8}
      />
    </main>
  );
}
