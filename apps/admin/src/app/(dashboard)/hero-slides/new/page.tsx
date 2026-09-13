import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import { listImageChoices } from "@bass/core/media-library";

import { EMPTY_VALUES } from "@/components/hero-slides/helpers";
import { SlideForm } from "@/components/hero-slides/slide-form";

import { saveHeroSlide } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New hero slide" };

export default async function NewHeroSlidePage() {
  await requirePagePermission("content:write");
  const choices = await listImageChoices();

  return (
    <div className="container-admin max-w-4xl py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/hero-slides" className="hover:underline">
          Hero slides
        </Link>
        <span aria-hidden="true"> / </span>
        New slide
      </nav>
      <h1 className="mt-3 text-2xl font-semibold text-navy-900">New slide</h1>
      <div className="mt-6">
        <SlideForm action={saveHeroSlide.bind(null, null)} values={EMPTY_VALUES} choices={choices} isNew />
      </div>
    </div>
  );
}
