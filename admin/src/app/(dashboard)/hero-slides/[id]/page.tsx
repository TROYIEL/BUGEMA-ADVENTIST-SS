import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { getHeroSlide } from "@/lib/hero-slides";
import { listImageChoices } from "@/lib/media-library";

import { slideToValues } from "@/components/hero-slides/helpers";
import { SlideForm } from "@/components/hero-slides/slide-form";

import { saveHeroSlide } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const slide = await getHeroSlide(id);
  return { title: slide ? `Edit: ${slide.title}` : "Hero slide" };
}

export default async function EditHeroSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const [slide, choices] = await Promise.all([getHeroSlide(id), listImageChoices()]);
  if (!slide) notFound();

  return (
    <div className="container-admin max-w-4xl py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/hero-slides" className="hover:underline">
          Hero slides
        </Link>
        <span aria-hidden="true"> / </span>
        {slide.title}
      </nav>
      <h1 className="mt-3 text-2xl font-semibold text-navy-900">{slide.title}</h1>
      <div className="mt-6">
        <SlideForm
          action={saveHeroSlide.bind(null, slide.id)}
          values={slideToValues(slide)}
          choices={choices}
          isNew={false}
        />
      </div>
    </div>
  );
}
