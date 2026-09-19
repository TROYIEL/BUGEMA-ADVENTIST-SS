// Must be first: loads the repository-root .env before anything reads it.
import "@/lib/db/env-load";

import { fromProjectRoot } from "@/lib/db/env";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  ContentStatus,
  MediaVisibility,
  NavigationMenu,
  StudyLevel,
} from "@/generated/prisma/enums";
import { checksum } from "@/lib/auth/crypto";
import { processImage } from "@/lib/media";
import { createPrismaClient } from "@/lib/db/client";
import { SETTINGS_REGISTRY, SETTING_KEYS } from "@/lib/settings-registry";
import { storage } from "@/lib/storage";

const db = createPrismaClient({ direct: true });

/**
 * Seeds structure, never facts.
 *
 * Everything the school must supply — contact details, motto, history,
 * leadership, subjects offered, fees, statistics — is created as an empty,
 * clearly-marked placeholder. Sections that would need invented prose to look
 * complete are seeded DISABLED so an administrator turns them on once real
 * copy exists, rather than the site shipping with plausible-sounding fiction.
 */

// ---------------------------------------------------------------------------
// Photographs
//
// The ten source images are a single photo session. Each is mapped to the one
// place it genuinely belongs. Alt text describes only what is visible in the
// frame and asserts nothing about the school.
// ---------------------------------------------------------------------------

// The source photographs and crest ship with the project, next to this seed.
const SOURCE_IMAGE_DIR = fromProjectRoot("prisma/images");

const IMAGE_INVENTORY = [
  {
    slug: "campus-pathway",
    file: "WhatsApp Image 2026-07-29 at 3.31.14 PM.jpeg",
    alt: "A student walks along a tree-lined campus pathway, with school buildings and open lawns beyond.",
    caption: "The main campus pathway.",
    folder: "campus",
  },
  {
    slug: "science-practical",
    file: "WhatsApp Image 2026-07-29 at 3.31.13 PM (1).jpeg",
    alt: "A teacher leads a biology practical, surrounded by students gathered closely around a laboratory bench.",
    caption: "A biology practical in the school laboratory.",
    folder: "academics",
  },
  {
    slug: "students-on-campus",
    file: "WhatsApp Image 2026-07-29 at 3.31.14 PM (2).jpeg",
    alt: "Two students in school uniform walk together and talk on a campus path.",
    caption: "Students between lessons.",
    folder: "student-life",
  },
  {
    slug: "students-studying",
    file: "WhatsApp Image 2026-07-29 at 3.31.14 PM (5).jpeg",
    alt: "Two students work together at a desk with a calculator and open exercise books.",
    caption: "Students at work in class.",
    folder: "academics",
  },
  {
    slug: "classroom",
    file: "WhatsApp Image 2026-07-29 at 3.31.14 PM (4).jpeg",
    alt: "Students seated at wooden desks in a classroom, working on written exercises.",
    caption: "A classroom during a lesson.",
    folder: "academics",
  },
  {
    slug: "laboratory-demonstration",
    file: "WhatsApp Image 2026-07-29 at 3.31.13 PM.jpeg",
    alt: "Students gather around a laboratory bench during a science demonstration.",
    caption: "A science demonstration.",
    folder: "academics",
  },
  {
    slug: "laboratory-specimen",
    file: "WhatsApp Image 2026-07-29 at 3.31.13 PM (2).jpeg",
    alt: "Students observe a specimen laid out on a laboratory bench during a practical lesson.",
    caption: "A practical biology lesson.",
    folder: "gallery",
  },
  {
    slug: "boarding-house",
    file: "WhatsApp Image 2026-07-29 at 3.31.13 PM (3).jpeg",
    alt: "A three-storey residential building with a red roof and water tanks alongside.",
    caption: "A residential building on campus.",
    folder: "facilities",
  },
  {
    slug: "school-kitchen",
    file: "WhatsApp Image 2026-07-29 at 3.31.14 PM (3).jpeg",
    alt: "A member of kitchen staff stirs a large cooking pot in the school kitchen, lit by tall windows.",
    caption: "Meals being prepared in the school kitchen.",
    folder: "facilities",
  },
  {
    slug: "student-portrait",
    file: "WhatsApp Image 2026-07-29 at 3.31.14 PM (1).jpeg",
    alt: "A student in school uniform stands on a campus path, with hedges and trees behind.",
    caption: "On campus.",
    folder: "student-life",
  },
] as const;

type ImageSlug = (typeof IMAGE_INVENTORY)[number]["slug"];

async function seedMedia(): Promise<Record<ImageSlug, string>> {
  const ids = {} as Record<ImageSlug, string>;

  for (const image of IMAGE_INVENTORY) {
    const storageKey = `seed/${image.slug}.webp`;
    const existing = await db.mediaAsset.findUnique({
      where: { storageKey },
      select: { id: true },
    });

    if (existing && (await storage.exists(storageKey))) {
      ids[image.slug] = existing.id;
      console.log(`  · ${image.slug} (already imported)`);
      continue;
    }

    const sourcePath = path.join(SOURCE_IMAGE_DIR, image.file);
    let original: Buffer;
    try {
      original = await readFile(sourcePath);
    } catch {
      console.warn(`  ! missing source image, skipping: ${image.file}`);
      continue;
    }

    // Re-encoded, EXIF stripped and bounded before it is ever stored.
    const processed = await processImage(original, { maxDimension: 2400 });
    await storage.put(storageKey, processed.buffer, processed.mimeType);

    const record = await db.mediaAsset.upsert({
      where: { storageKey },
      update: {
        alt: image.alt,
        caption: image.caption,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        size: processed.buffer.byteLength,
      },
      create: {
        storageKey,
        filename: `${image.slug}.webp`,
        originalName: image.file,
        mimeType: processed.mimeType,
        size: processed.buffer.byteLength,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        alt: image.alt,
        caption: image.caption,
        folder: image.folder,
        visibility: MediaVisibility.PUBLIC,
        checksum: checksum(processed.buffer),
      },
      select: { id: true },
    });

    ids[image.slug] = record.id;
    console.log(
      `  · ${image.slug} → ${processed.width}×${processed.height}, ${(processed.buffer.byteLength / 1024).toFixed(0)} KB`,
    );
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

const LOGO_FILE = "BASS LOGO.png";
const LOGO_KEY = "brand/bass-logo.webp";

/**
 * Imports the school crest supplied by the school.
 *
 * Re-encoded to WebP at high quality with the alpha channel intact — the mark
 * has a transparent background and must stay transparent. Unlike the
 * photographs it is NOT aggressively compressed: a crest with artefacts around
 * the lettering looks cheap at any size.
 */
async function seedBrandLogo(): Promise<string | null> {
  const sourcePath = path.join(SOURCE_IMAGE_DIR, LOGO_FILE);

  let original: Buffer;
  try {
    original = await readFile(sourcePath);
  } catch {
    console.warn(`  ! logo not found at ${LOGO_FILE}; the typographic placeholder stays in use`);
    return null;
  }

  const processed = await processImage(original, {
    maxDimension: 1412,
    quality: 95,
  });
  await storage.put(LOGO_KEY, processed.buffer, processed.mimeType);

  const asset = await db.mediaAsset.upsert({
    where: { storageKey: LOGO_KEY },
    update: {
      width: processed.width,
      height: processed.height,
      size: processed.buffer.byteLength,
      blurDataUrl: processed.blurDataUrl,
    },
    create: {
      storageKey: LOGO_KEY,
      filename: "bass-logo.webp",
      originalName: LOGO_FILE,
      mimeType: processed.mimeType,
      size: processed.buffer.byteLength,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      alt: "Bugema Adventist Secondary School crest",
      folder: "brand",
      visibility: MediaVisibility.PUBLIC,
      checksum: checksum(processed.buffer),
    },
    select: { id: true },
  });

  // Point the site setting at it and mark it configured, so the placeholder
  // monogram is retired and it stops appearing on the "complete your site" list.
  await db.siteSetting.update({
    where: { key: "school.logo" },
    data: { value: asset.id, isConfigured: true },
  });

  console.log(`  \u00b7 crest \u2192 ${processed.width}\u00d7${processed.height}, ${(processed.buffer.byteLength / 1024).toFixed(0)} KB`);
  return asset.id;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function seedSettings() {
  for (const key of SETTING_KEYS) {
    const definition = SETTINGS_REGISTRY[key];

    await db.siteSetting.upsert({
      where: { key },
      // Only metadata is refreshed on re-seed. A value an administrator has
      // already entered is never overwritten.
      update: {
        group: definition.group,
        label: definition.label,
        description: definition.description,
        order: definition.order,
      },
      create: {
        key,
        group: definition.group,
        label: definition.label,
        description: definition.description,
        order: definition.order,
        value: String(definition.default),
        isConfigured: Boolean(definition.seeded),
      },
    });
  }

  // Counted from the database, not the registry: a value an administrator has
  // already filled in must not be reported as still outstanding.
  const pending = await db.siteSetting.count({ where: { isConfigured: false } });
  console.log(
    `  · ${SETTING_KEYS.length} settings (${pending} awaiting real values from the school)`,
  );
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const HEADER_NAV = [
  // Section descriptions are navigational copy — they say what a section
  // contains — so they are seeded. Nothing here asserts a fact about the
  // school that the school has not confirmed.
  { label: "About", href: "/about", description: "Who we are, what we stand for, and the people who run the school.", children: [
    { label: "Our story", href: "/about/history", description: "How the school came to be." },
    { label: "Mission & vision", href: "/about/mission-vision", description: "What we are here to do." },
    { label: "Our values", href: "/about/values", description: "The principles behind school life." },
    { label: "Leadership", href: "/about/leadership", description: "The senior team and staff." },
    { label: "Facilities", href: "/about/facilities", description: "Classrooms, laboratories, boarding and grounds." },
  ]},
  { label: "Academics", href: "/academics", description: "Programmes, departments and the subjects taught at each level.", children: [
    { label: "Programmes", href: "/academics", description: "O-level and A-level study." },
    { label: "Departments", href: "/academics/departments", description: "How teaching is organised." },
    { label: "Subjects", href: "/academics/subjects", description: "Everything on offer, by level." },
    { label: "Curriculum", href: "/academics/curriculum", description: "What students study, year by year." },
    { label: "Co-curricular", href: "/academics/co-curricular", description: "Sport, music, clubs and service." },
  ]},
  { label: "Admissions", href: "/admissions", highlight: true, description: "Entry requirements, how to apply, and how to follow an application.", children: [
    { label: "How to apply", href: "/admissions/how-to-apply", description: "The process, step by step." },
    { label: "Entry requirements", href: "/admissions/requirements", description: "What each year group asks for." },
    { label: "Apply online", href: "/admissions/apply", description: "Start or resume an application." },
    { label: "Check your application", href: "/admissions/application-status", description: "Follow progress using your reference." },
  ]},
  { label: "Student life", href: "/student-life", description: "Boarding, worship, sport and leadership.", children: [] },
  { label: "News & events", href: "/news", description: "School news, and what is coming up in the calendar.", children: [
    { label: "News", href: "/news", description: "Announcements and stories from the school." },
    { label: "Events", href: "/events", description: "Open days, term dates and gatherings." },
  ]},
  { label: "Gallery", href: "/gallery", description: "Photographs of school life.", children: [] },
  { label: "Contact", href: "/contact", description: "Reach the school office.", children: [] },
] as const;

const FOOTER_PRIMARY = [
  { label: "About the school", href: "/about" },
  { label: "Academics", href: "/academics" },
  { label: "Student life", href: "/student-life" },
  { label: "News & events", href: "/news" },
  { label: "Gallery", href: "/gallery" },
] as const;

const FOOTER_SECONDARY = [
  { label: "How to apply", href: "/admissions/how-to-apply" },
  { label: "Entry requirements", href: "/admissions/requirements" },
  { label: "Apply online", href: "/admissions/apply" },
  { label: "Check your application", href: "/admissions/application-status" },
  { label: "Contact us", href: "/contact" },
] as const;

const LEGAL_NAV = [
  { label: "Privacy policy", href: "/policies/privacy" },
  { label: "Terms of use", href: "/policies/terms" },
  { label: "Admissions policy", href: "/policies/admissions" },
  { label: "Safeguarding", href: "/policies/safeguarding" },
] as const;

async function upsertNavItem(input: {
  menu: NavigationMenu;
  label: string;
  href: string;
  order: number;
  parentId?: string | null;
  description?: string;
  highlight?: boolean;
}) {
  const existing = await db.navigationItem.findFirst({
    where: {
      menu: input.menu,
      href: input.href,
      parentId: input.parentId ?? null,
    },
    select: { id: true },
  });

  if (existing) {
    await db.navigationItem.update({
      where: { id: existing.id },
      data: { label: input.label, order: input.order, description: input.description },
    });
    return existing.id;
  }

  const created = await db.navigationItem.create({
    data: {
      menu: input.menu,
      label: input.label,
      href: input.href,
      order: input.order,
      parentId: input.parentId ?? null,
      description: input.description,
      highlight: input.highlight ?? false,
    },
    select: { id: true },
  });
  return created.id;
}

async function seedNavigation() {
  let order = 0;
  for (const item of HEADER_NAV) {
    const parentId = await upsertNavItem({
      menu: NavigationMenu.HEADER,
      label: item.label,
      href: item.href,
      order: (order += 10),
      description: "description" in item ? item.description : undefined,
      highlight: "highlight" in item ? item.highlight : false,
    });

    let childOrder = 0;
    for (const child of item.children) {
      await upsertNavItem({
        menu: NavigationMenu.HEADER,
        label: child.label,
        href: child.href,
        order: (childOrder += 10),
        parentId,
        description: "description" in child ? child.description : undefined,
      });
    }
  }

  const menus = [
    [NavigationMenu.FOOTER_PRIMARY, FOOTER_PRIMARY],
    [NavigationMenu.FOOTER_SECONDARY, FOOTER_SECONDARY],
    [NavigationMenu.LEGAL, LEGAL_NAV],
  ] as const;

  for (const [menu, items] of menus) {
    let menuOrder = 0;
    for (const item of items) {
      await upsertNavItem({
        menu,
        label: item.label,
        href: item.href,
        order: (menuOrder += 10),
      });
    }
  }

  const total = await db.navigationItem.count();
  console.log(`  · ${total} navigation items`);
}

// ---------------------------------------------------------------------------
// Pages
//
// Created so the navigation resolves and administrators have somewhere to
// write. Bodies are intentionally empty: the public page renders a neutral
// notice rather than invented history, values or policy text.
// ---------------------------------------------------------------------------

const PAGES = [
  { slug: "about", title: "About the school", subtitle: "Who we are." },
  { slug: "about/history", title: "Our story" },
  { slug: "about/mission-vision", title: "Mission & vision" },
  { slug: "about/values", title: "Our values" },
  { slug: "about/leadership", title: "Leadership" },
  { slug: "about/facilities", title: "Facilities" },
  { slug: "academics", title: "Academics" },
  { slug: "academics/curriculum", title: "Curriculum" },
  { slug: "academics/co-curricular", title: "Co-curricular activities" },
  { slug: "admissions", title: "Admissions" },
  { slug: "admissions/how-to-apply", title: "How to apply" },
  { slug: "admissions/requirements", title: "Entry requirements" },
  { slug: "student-life", title: "Student life" },
  { slug: "contact", title: "Contact us" },
  { slug: "policies/privacy", title: "Privacy policy" },
  { slug: "policies/terms", title: "Terms of use" },
  { slug: "policies/admissions", title: "Admissions policy" },
  { slug: "policies/safeguarding", title: "Safeguarding" },
] as const;

async function seedPages() {
  for (const page of PAGES) {
    await db.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
        title: page.title,
        subtitle: "subtitle" in page ? page.subtitle : null,
        body: null,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        isSystem: true,
      },
    });
  }
  console.log(`  · ${PAGES.length} pages (all awaiting content)`);
}

// ---------------------------------------------------------------------------
// Homepage sections
// ---------------------------------------------------------------------------

async function seedHomepageImages(media: Record<ImageSlug, string>) {
  // The homepage layout is fixed in code. These settings choose which
  // photographs it uses, so the front page can be refreshed without a
  // deployment. The feature cards and highlights below them stay EMPTY: they
  // need words and figures only the school can supply.
  const choices: [string, string | undefined][] = [
    ["home.heroImage", media["campus-pathway"]],
    ["home.heroCollageOne", media["science-practical"]],
    ["home.heroCollageTwo", media["students-on-campus"]],
    ["home.heroCollageThree", media["students-studying"]],
    ["home.aboutImage", media["science-practical"]],
  ];

  let applied = 0;
  for (const [key, mediaId] of choices) {
    if (!mediaId) continue;
    const existing = await db.siteSetting.findUnique({
      where: { key },
      select: { isConfigured: true },
    });
    // Never overwrite a choice an administrator has already made.
    if (existing?.isConfigured) continue;

    await db.siteSetting.update({
      where: { key },
      data: { value: mediaId, isConfigured: true },
    });
    applied++;
  }

  const features = await db.homeFeature.count();
  const highlights = await db.homeHighlight.count();
  console.log(
    `  \u00b7 ${applied} homepage images set; ${features} feature cards and ${highlights} highlights (both await school copy)`,
  );
}

// ---------------------------------------------------------------------------
// Admissions configuration
// ---------------------------------------------------------------------------

async function seedAdmissions() {
  const year = String(new Date().getFullYear() + 1);

  await db.academicYear.upsert({
    where: { name: year },
    update: {},
    create: {
      name: year,
      isActive: true,
      // Applications stay closed until the school opens them deliberately.
      isAcceptingApplications: false,
    },
  });

  // Uganda's secondary structure: S1–S4 (O-level), S5–S6 (A-level).
  const classes = [
    { name: "Senior 1", level: StudyLevel.O_LEVEL, order: 10 },
    { name: "Senior 2", level: StudyLevel.O_LEVEL, order: 20 },
    { name: "Senior 3", level: StudyLevel.O_LEVEL, order: 30 },
    { name: "Senior 4", level: StudyLevel.O_LEVEL, order: 40 },
    { name: "Senior 5", level: StudyLevel.A_LEVEL, order: 50 },
    { name: "Senior 6", level: StudyLevel.A_LEVEL, order: 60 },
  ];

  for (const entry of classes) {
    await db.applicationClass.upsert({
      where: { name: entry.name },
      update: { level: entry.level, order: entry.order },
      create: entry,
    });
  }

  // Offered as options only. None is marked required, because the school has
  // not told us what it actually requires.
  const documentTypes = [
    { name: "Passport photograph", order: 10, acceptedMimeTypes: ["image/jpeg", "image/png"] },
    { name: "Most recent school report", order: 20 },
    { name: "Birth certificate", order: 30 },
    { name: "Recommendation letter", order: 40 },
    { name: "Examination result slip", order: 50 },
  ];

  for (const entry of documentTypes) {
    await db.documentType.upsert({
      where: { name: entry.name },
      update: { order: entry.order },
      create: {
        name: entry.name,
        order: entry.order,
        isRequired: false,
        acceptedMimeTypes:
          "acceptedMimeTypes" in entry && entry.acceptedMimeTypes
            ? entry.acceptedMimeTypes
            : ["image/jpeg", "image/png", "application/pdf"],
      },
    });
  }

  console.log(
    `  · academic year ${year} (applications closed), ${classes.length} classes, ${documentTypes.length} document types (none required yet)`,
  );
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

async function seedGallery(media: Record<ImageSlug, string>) {
  const album = await db.galleryAlbum.upsert({
    where: { slug: "life-at-bass" },
    update: {},
    create: {
      slug: "life-at-bass",
      title: "Life at BASS",
      description: null,
      coverImageId: media["students-on-campus"] ?? null,
      status: ContentStatus.PUBLISHED,
      order: 10,
    },
    select: { id: true },
  });

  const entries: ImageSlug[] = [
    "campus-pathway",
    "students-on-campus",
    "science-practical",
    "laboratory-specimen",
    "classroom",
    "boarding-house",
    "school-kitchen",
    "student-portrait",
  ];

  let order = 0;
  for (const slug of entries) {
    const mediaId = media[slug];
    if (!mediaId) continue;

    const source = IMAGE_INVENTORY.find((image) => image.slug === slug);
    await db.galleryImage.upsert({
      where: { albumId_mediaId: { albumId: album.id, mediaId } },
      update: { order: (order += 10) },
      create: {
        albumId: album.id,
        mediaId,
        caption: source?.caption ?? null,
        order,
      },
    });
  }

  console.log(`  · 1 gallery album with ${entries.length} photographs`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("\nSeeding BASS\n");

  console.log("Photographs");
  const media = await seedMedia();

  console.log("Settings");
  await seedSettings();

  console.log("Brand");
  await seedBrandLogo();

  console.log("Navigation");
  await seedNavigation();

  console.log("Pages");
  await seedPages();

  console.log("Homepage");
  await seedHomepageImages(media);

  console.log("Admissions");
  await seedAdmissions();

  console.log("Gallery");
  await seedGallery(media);

  console.log("Search index");
  const { reindexAll } = await import("@/lib/search");
  console.log(`  \u00b7 ${await reindexAll()} documents indexed`);

  const admins = await db.user.count();
  console.log("\nDone.");
  if (admins === 0) {
    console.log("\nNext: create the first administrator with `npm run create-admin`.\n");
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
