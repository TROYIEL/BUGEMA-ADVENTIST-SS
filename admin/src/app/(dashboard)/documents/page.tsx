import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/dal";
import { listPendingDocuments } from "@/lib/applications-admin";
import { EmptyState } from "@/components/ui/empty-state";

import { formatBytes, formatDateTime, fullName } from "@/components/applications/format";
import { StatusBadge } from "@/components/applications/status-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Documents to review" };

/**
 * Every document nobody has looked at, oldest first. Reviewing happens on the
 * application itself, where the rest of the file gives it context; this page
 * is the queue that says where to go next.
 */
export default async function DocumentsPage() {
  await requirePagePermission("documents:review");
  const queue = await listPendingDocuments();

  return (
    <div className="container-admin py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Documents to review</h1>
        <p className="mt-1 text-sm text-ink-600">
          {queue.length === 0
            ? "Every uploaded document has been reviewed."
            : `${queue.length} ${queue.length === 1 ? "document is" : "documents are"} waiting, oldest first.`}
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Nothing waiting"
          description="New uploads from applicants will appear here until someone reviews them."
        />
      ) : (
        <div className="mt-6 relative overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-surface-sunken text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
              <tr>
                <th scope="col" className="px-4 py-3">Document</th>
                <th scope="col" className="px-4 py-3">Applicant</th>
                <th scope="col" className="px-4 py-3">Application</th>
                <th scope="col" className="px-4 py-3">Uploaded</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queue.map((doc) => (
                <tr key={doc.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-900">{doc.documentType?.name ?? "Document"}</p>
                    <p className="text-xs text-ink-500">
                      {doc.mediaAsset.originalName} · {formatBytes(doc.mediaAsset.size)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-navy-900">{fullName(doc.application)}</p>
                    <p className="text-xs text-ink-500">{doc.application.applicationClass?.name ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[0.8125rem] text-navy-900">
                      {doc.application.referenceNumber}
                    </p>
                    <StatusBadge status={doc.application.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-700">{formatDateTime(doc.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/applications/${doc.application.id}`}
                      className="text-sm font-semibold text-navy-800 hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
