import type { Metadata } from "next";

import { getAdmissionsWindow } from "@bass/core/applications";
import { getPublicHeroSlides } from "@bass/core/hero-slides";
import { getHomeFeatures, getHomeHighlights, getHomeImages } from "@bass/core/home";
import {
  formatDate,
  formatDateRange,
  getLatestNews,
  getPageBySlug,
  getUpcomingEvents,
} from "@bass/core/content";
import { getSiteSettings, readSetting } from "@bass/core/settings";
import { richTextToParagraphs, truncate } from "@bass/core/sanitize";

import type { HeroSlideData } from "@/components/sections/hero";
import { HeroCarousel } from "@/components/sections/hero-carousel";
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

/**
 * Whole paragraphs up to a character budget, the last one trimmed to fit.
 * Nothing is dropped mid-sentence unless the budget runs out inside it.
 */
function takeParagraphs(paragraphs: string[], budget: number): string[] {
  const taken: string[] = [];
  let used = 0;
  for (const paragraph of paragraphs) {
    if (used >= budget) break;
    const room = budget - used;
    taken.push(paragraph.length > room ? truncate(paragraph, room) : paragraph);
    used += paragraph.length;
  }
  return taken;
}

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
  const [settings, images, features, highlights, aboutPage, admissions, news, events, heroSlides] =
    await Promise.all([
      getSiteSettings(),
      getHomeImages(),
      getHomeFeatures(),
      getHomeHighlights(),
      getPageBySlug("about"),
      getAdmissionsWindow(),
      getLatestNews(3),
      getUpcomingEvents(3),
      getPublicHeroSlides(),
    ]);

  const schoolName =
    readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";

  // The featured band reuses the About page's own words rather than keeping a
  // second copy of them that could drift out of step: the subtitle (or the
  // first paragraph) as the blurb, and the next few paragraphs behind
  // "show more". The whole page is one click away, so this stays short.
  const aboutParagraphs = aboutPage ? richTextToParagraphs(aboutPage.body) : [];
  const aboutSummary = aboutPage
    ? (aboutPage.subtitle ?? truncate(aboutParagraphs[0] ?? "", 260))
    : null;
  const aboutDetails = takeParagraphs(
    aboutPage?.subtitle ? aboutParagraphs : aboutParagraphs.slice(1),
    700,
  );

  // Slides the school has composed in the administration app come first and
  // alone. Without any, the hero assembles its own from content that already
  // exists — the school's settings, the admissions window, the latest story
  // and the next event — never from copy written for the slider. A slide
  // without its content is simply not built, so the hero is never padded out.
  const phone = readSetting(settings, "contact.phone");
  const configuredSlides: HeroSlideData[] = heroSlides.map((slide) => ({
    id: slide.id,
    subtitle: slide.subtitle,
    title: slide.title,
    body: slide.body,
    displayText: slide.displayText,
    ctaLabel: slide.ctaLabel,
    ctaHref: slide.ctaHref,
    ctaSecondaryLabel: slide.ctaSecondaryLabel,
    ctaSecondaryHref: slide.ctaSecondaryHref,
    phone: slide.showPhone ? phone : null,
    image: slide.image,
    collage: [slide.collageOne, slide.collageTwo, slide.collageThree].filter(
      (asset): asset is NonNullable<typeof asset> => Boolean(asset),
    ),
  }));

  const slides: HeroSlideData[] = [
    {
      id: "school",
      title: schoolName,
      body: readSetting(settings, "school.tagline"),
      displayText: readSetting(settings, "school.motto"),
      phone,
      ctaLabel: "Apply for admission",
      ctaHref: "/admissions/apply",
      ctaSecondaryLabel: "Explore BASS",
      ctaSecondaryHref: "/about",
      image: images.hero,
      collage: images.collage,
    },
  ];

  if (admissions.isOpen && admissions.year) {
    slides.push({
      id: "admissions",
      subtitle: "Admissions",
      title: `Applications open for ${admissions.year.name}`,
      body:
        readSetting(settings, "admissions.introduction") ??
        "Apply online in a few minutes. Your progress is saved as you go, so you can come back to finish.",
      ctaLabel: "Start an application",
      ctaHref: "/admissions/apply",
      ctaSecondaryLabel: "Entry requirements",
      ctaSecondaryHref: "/admissions/requirements",
      image: images.hero,
      // The same prints in a different order, so the slide reads as its own.
      collage: [...images.collage.slice(1), ...images.collage.slice(0, 1)],
      displayText: admissions.year.applicationClosesAt
        ? `Closing ${formatDate(admissions.year.applicationClosesAt)}`
        : null,
    });
  }

  const story = news[0];
  if (story) {
    slides.push({
      id: `news-${story.id}`,
      subtitle: story.category ?? "Latest news",
      title: story.title,
      body: story.excerpt,
      ctaLabel: "Read the story",
      ctaHref: `/news/${story.slug}`,
      ctaSecondaryLabel: "All news",
      ctaSecondaryHref: "/news",
      image: story.featuredImage ?? images.hero,
      // The latest stories' photographs stand in for the prints.
      collage: news.flatMap((article) => (article.featuredImage ? [article.featuredImage] : [])),
      displayText: story.publishedAt ? formatDate(story.publishedAt) : null,
    });
  }

  const event = events[0];
  if (event) {
    const when = [formatDateRange(event.startDate, event.endDate), event.startTime, event.location]
      .filter(Boolean)
      .join(" · ");
    slides.push({
      id: `event-${event.id}`,
      subtitle: "Coming up",
      title: event.title,
      body: when,
      ctaLabel: "Event details",
      ctaHref: `/events/${event.slug}`,
      ctaSecondaryLabel: "All events",
      ctaSecondaryHref: "/events",
      image: event.image ?? images.hero,
      collage: events.flatMap((entry) => (entry.image ? [entry.image] : [])),
      displayText: formatDate(event.startDate),
    });
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <HeroCarousel slides={configuredSlides.length > 0 ? configuredSlides : slides} />

      <QuickActions title="Start your application" body={"Start you journey with us click Apply  or check the requirements for applying"} actions={QUICK_ACTIONS} />

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
          details: aboutDetails,
          detailsLabel: "A little more about us",
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
