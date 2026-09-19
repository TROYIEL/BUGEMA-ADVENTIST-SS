import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { Breadcrumb } from "./content-table";

/**
 * The frame around every content editor: breadcrumb, heading, the alerts a
 * redirect can carry (?saved, ?locked), the form, and a delete panel for
 * existing rows.
 */
export function EditorShell({
  crumbs,
  title,
  saved,
  locked,
  viewHref,
  children,
  deleteAction,
  deleteId,
  deleteNote,
  deleteDisabledReason,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  saved?: boolean;
  locked?: boolean;
  /** Public address, when the row is published. */
  viewHref?: string | null;
  children: ReactNode;
  deleteAction?: (formData: FormData) => Promise<void>;
  deleteId?: string;
  deleteNote?: string;
  deleteDisabledReason?: string | null;
}) {
  return (
    <div className="container-admin max-w-4xl py-8">
      <Breadcrumb items={crumbs} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
        {viewHref ? (
          <a href={viewHref} target="_blank" rel="noopener" className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
            View on the website ↗
          </a>
        ) : null}
      </div>

      {saved ? <Alert tone="success" className="mt-4">Saved.</Alert> : null}
      {locked ? (
        <Alert tone="warning" className="mt-4" title="Not deleted">
          {deleteDisabledReason ?? "This cannot be deleted."}
        </Alert>
      ) : null}

      <div className="mt-6">{children}</div>

      {deleteAction && deleteId ? (
        <section className="mt-8 rounded-lg border border-danger-600/30 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-navy-900">Delete</h2>
              <p className="mt-0.5 text-sm text-ink-600">{deleteDisabledReason ?? deleteNote ?? "This cannot be undone."}</p>
            </div>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={deleteId} />
              <Button type="submit" variant="danger" size="sm" disabled={Boolean(deleteDisabledReason)}>
                Delete
              </Button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function siteUrl(path: string): string {
  return `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}
