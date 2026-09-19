import type { HeroSlideRow } from "@bass/core/hero-slides";

/** Everything the form edits, as the strings its inputs hold. */
export type SlideFormValues = {
  title: string;
  subtitle: string;
  body: string;
  displayText: string;
  ctaLabel: string;
  ctaHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  showPhone: boolean;
  isActive: boolean;
  publishFrom: string;
  publishUntil: string;
  imageId: string;
  collageOneId: string;
  collageTwoId: string;
  collageThreeId: string;
};

export const EMPTY_VALUES: SlideFormValues = {
  title: "",
  subtitle: "",
  body: "",
  displayText: "",
  ctaLabel: "",
  ctaHref: "",
  ctaSecondaryLabel: "",
  ctaSecondaryHref: "",
  showPhone: false,
  isActive: true,
  publishFrom: "",
  publishUntil: "",
  imageId: "",
  collageOneId: "",
  collageTwoId: "",
  collageThreeId: "",
};


/** A stored date as the "YYYY-MM-DDTHH:MM" a datetime-local input wants, in Kampala time. */
export function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function slideToValues(slide: HeroSlideRow): SlideFormValues {
  return {
    title: slide.title,
    subtitle: slide.subtitle ?? "",
    body: slide.body ?? "",
    displayText: slide.displayText ?? "",
    ctaLabel: slide.ctaLabel ?? "",
    ctaHref: slide.ctaHref ?? "",
    ctaSecondaryLabel: slide.ctaSecondaryLabel ?? "",
    ctaSecondaryHref: slide.ctaSecondaryHref ?? "",
    showPhone: slide.showPhone,
    isActive: slide.isActive,
    publishFrom: toLocalInput(slide.publishFrom),
    publishUntil: toLocalInput(slide.publishUntil),
    imageId: slide.imageId ?? "",
    collageOneId: slide.collageOneId ?? "",
    collageTwoId: slide.collageTwoId ?? "",
    collageThreeId: slide.collageThreeId ?? "",
  };
}
