import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/site/page-header";
import { ButtonLink } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";
import { ContentStatus, StudyLevel } from "@/generated/prisma/enums";
import { MEDIA_SELECT } from "@/lib/content";
import { db } from "@/lib/db";
import { richTextToPlainText, truncate } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const LEVEL_LABELS: Record<StudyLevel, string> = {
  [StudyLevel.O_LEVEL]: "O-level",
  [StudyLevel.A_LEVEL]: "A-level",
  [StudyLevel.BOTH]: "O- and A-level",
};

async function getProgram(slug: string) {
  return db.academicProgram.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      body: true,
      level: true,
      image: { select: MEDIA_SELECT },
    },
  });
}

export async function generateMetadata(
  props: PageProps<"/academics/programmes/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const program = await getProgram(slug);
  if (!program) return {};

  const description =
    program.summary ?? truncate(richTextToPlainText(program.body), 155);

  return {
    title: program.title,
    ...(description ? { description } : {}),
    alternates: { canonical: `/academics/programmes/${program.slug}` },
  };
}

export default async function ProgramPage(
  props: PageProps<"/academics/programmes/[slug]">,
) {
  const { slug } = await props.params;
  const program = await getProgram(slug);
  if (!program) notFound();

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={program.title}
        subtitle={program.summary}
        eyebrow={LEVEL_LABELS[program.level]}
        image={program.image}
        crumbs={[
          { label: "Academics", href: "/academics" },
          { label: program.title },
        ]}
      />

      <div className="container-page py-14 md:py-16">
        <RichText html={program.body} />

        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink href="/admissions/apply" withArrow>
            Apply for admission
          </ButtonLink>
          <ButtonLink href="/admissions/requirements" variant="secondary">
            Entry requirements
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
