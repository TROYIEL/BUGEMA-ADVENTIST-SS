import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { ContentStatus } from "@/generated/prisma/enums";
import { getEvent } from "@/lib/content-admin";
import { listImageChoices } from "@/lib/media-library";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { EventForm } from "@/components/content/forms";
import { toDateInput } from "@/lib/forms";

import { deleteEventAction, saveEventAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `Edit: ${event.title}` : "Event" };
}

export default async function EditEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePagePermission("content:write");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [event, choices] = await Promise.all([getEvent(id), listImageChoices()]);
  if (!event) notFound();

  return (
    <EditorShell
      crumbs={[{ label: "Events", href: "/events" }, { label: event.title }]}
      title={event.title}
      saved={saved === "1"}
      viewHref={event.status === ContentStatus.PUBLISHED ? siteUrl(`/events/${event.slug}`) : null}
      deleteAction={deleteEventAction}
      deleteId={event.id}
      deleteNote="Removes the event from the website and from search."
    >
      <EventForm
        action={saveEventAction.bind(null, event.id)}
        values={{
          title: event.title,
          slug: event.slug,
          description: event.description ?? "",
          body: event.body ?? "",
          startDate: toDateInput(event.startDate),
          endDate: toDateInput(event.endDate),
          startTime: event.startTime ?? "",
          endTime: event.endTime ?? "",
          location: event.location ?? "",
          registrationUrl: event.registrationUrl ?? "",
          status: event.status,
          isFeatured: event.isFeatured,
          seoTitle: event.seoTitle ?? "",
          seoDescription: event.seoDescription ?? "",
          imageId: event.imageId ?? "",
        }}
        choices={choices}
        isNew={false}
      />
    </EditorShell>
  );
}
