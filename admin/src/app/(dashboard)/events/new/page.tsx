import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { listImageChoices } from "@/lib/media-library";

import { EditorShell } from "@/components/content/editor-shell";
import { EventForm } from "@/components/content/forms";

import { saveEventAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requirePagePermission("content:write");
  const choices = await listImageChoices();
  return (
    <EditorShell crumbs={[{ label: "Events", href: "/events" }, { label: "New event" }]} title="New event">
      <EventForm
        action={saveEventAction.bind(null, null)}
        values={{ title: "", slug: "", description: "", body: "", startDate: "", endDate: "", startTime: "", endTime: "", location: "", registrationUrl: "", status: "DRAFT", isFeatured: false, seoTitle: "", seoDescription: "", imageId: "" }}
        choices={choices}
        isNew
      />
    </EditorShell>
  );
}
