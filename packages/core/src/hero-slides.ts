import "server-only";

import { cache } from "react";

import type { Prisma } from "@bass/db/types";
import { db } from "@bass/db";

import { MEDIA_SELECT } from "./content";

/**
 * Hero slides, composed by the school in the administration app.
 *
 * The public site shows the active slides whose schedule has arrived, in
 * order. With none, it builds its own from settings and the latest content
 * (see the homepage), so the front page is never empty.
 */

const SLIDE_SELECT = {
  id: true,
  title: true,
  subtitle: true,
  body: true,
  displayText: true,
  ctaLabel: true,
  ctaHref: true,
  ctaSecondaryLabel: true,
  ctaSecondaryHref: true,
  showPhone: true,
  order: true,
  isActive: true,
  publishFrom: true,
  publishUntil: true,
  updatedAt: true,
  imageId: true,
  collageOneId: true,
  collageTwoId: true,
  collageThreeId: true,
  image: { select: MEDIA_SELECT },
  collageOne: { select: MEDIA_SELECT },
  collageTwo: { select: MEDIA_SELECT },
  collageThree: { select: MEDIA_SELECT },
} satisfies Prisma.HeroSlideSelect;

export type HeroSlideRow = Prisma.HeroSlideGetPayload<{ select: typeof SLIDE_SELECT }>;

/** Whether a slide is showing right now, by its switch and its schedule. */
export function isSlideLive(
  slide: Pick<HeroSlideRow, "isActive" | "publishFrom" | "publishUntil">,
  now = new Date(),
): boolean {
  if (!slide.isActive) return false;
  if (slide.publishFrom && slide.publishFrom > now) return false;
  if (slide.publishUntil && slide.publishUntil < now) return false;
  return true;
}

export const getPublicHeroSlides = cache(async (): Promise<HeroSlideRow[]> => {
  const now = new Date();
  return db.heroSlide.findMany({
    where: {
      isActive: true,
      OR: [{ publishFrom: null }, { publishFrom: { lte: now } }],
      AND: [{ OR: [{ publishUntil: null }, { publishUntil: { gte: now } }] }],
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: SLIDE_SELECT,
  });
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export async function listHeroSlides(): Promise<HeroSlideRow[]> {
  return db.heroSlide.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: SLIDE_SELECT,
  });
}

export async function getHeroSlide(id: string): Promise<HeroSlideRow | null> {
  return db.heroSlide.findUnique({ where: { id }, select: SLIDE_SELECT });
}

export type HeroSlideInput = {
  title: string;
  subtitle: string | null;
  body: string | null;
  displayText: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
  showPhone: boolean;
  imageId: string | null;
  collageOneId: string | null;
  collageTwoId: string | null;
  collageThreeId: string | null;
  isActive: boolean;
  publishFrom: Date | null;
  publishUntil: Date | null;
};

/** New slides go to the end of the order. */
export async function createHeroSlide(input: HeroSlideInput): Promise<{ id: string }> {
  const last = await db.heroSlide.aggregate({ _max: { order: true } });
  return db.heroSlide.create({
    data: { ...input, order: (last._max.order ?? 0) + 10 },
    select: { id: true },
  });
}

export async function updateHeroSlide(id: string, input: HeroSlideInput): Promise<void> {
  await db.heroSlide.update({ where: { id }, data: input });
}

export async function deleteHeroSlide(id: string): Promise<void> {
  await db.heroSlide.delete({ where: { id } });
}

export async function setHeroSlideActive(id: string, isActive: boolean): Promise<void> {
  await db.heroSlide.update({ where: { id }, data: { isActive } });
}

/**
 * Swaps a slide with its neighbour. Orders are renumbered first so the swap
 * is always between adjacent, distinct values whatever history left behind.
 */
export async function moveHeroSlide(id: string, direction: "up" | "down"): Promise<void> {
  await db.$transaction(async (tx) => {
    const slides = await tx.heroSlide.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const index = slides.findIndex((slide) => slide.id === id);
    if (index === -1) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;

    const reordered = [...slides];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];

    await Promise.all(
      reordered.map((slide, position) =>
        tx.heroSlide.update({ where: { id: slide.id }, data: { order: (position + 1) * 10 } }),
      ),
    );
  });
}
