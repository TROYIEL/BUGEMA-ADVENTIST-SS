import type { Metadata } from "next";

import { ContactForm } from "@/app/(site)/contact/contact-form";
import { PageHeader } from "@/components/site/page-header";
import { Alert } from "@bass/ui/alert";
import { getPageBySlug } from "@bass/core/content";
import { getSiteSettings, readSetting, type SettingKey } from "@bass/core/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact us",
  alternates: { canonical: "/contact" },
};

const DETAIL_ROWS: {
  key: SettingKey;
  label: string;
  scheme?: "tel" | "mailto";
}[] = [
  { key: "contact.physicalAddress", label: "Address" },
  { key: "contact.postalAddress", label: "Postal address" },
  { key: "contact.phone", label: "Telephone", scheme: "tel" },
  { key: "contact.altPhone", label: "Alternative telephone", scheme: "tel" },
  { key: "contact.email", label: "Email", scheme: "mailto" },
  { key: "contact.officeHours", label: "Office hours" },
];

export default async function ContactPage() {
  const [settings, page] = await Promise.all([
    getSiteSettings(),
    getPageBySlug("contact"),
  ]);

  // Only details the school has actually supplied are shown. Nothing here is
  // a placeholder standing in for a real address or telephone number.
  const details = DETAIL_ROWS.map((row) => ({
    ...row,
    value: readSetting(settings, row.key),
  })).filter((row): row is typeof row & { value: string } => Boolean(row.value));

  const mapEmbedUrl = readSetting(settings, "contact.mapEmbedUrl");

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={page?.title ?? "Contact us"}
        subtitle={page?.subtitle}
        crumbs={[{ label: "Contact us" }]}
      />

      <div className="container-page grid gap-12 py-14 md:py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div>
          <h2 className="font-serif text-2xl text-navy-900">Send us a message</h2>
          <p className="mt-2 max-w-xl leading-relaxed text-ink-600">
            Use the form below and the school office will reply as soon as
            possible.
          </p>
          <div className="mt-8 max-w-2xl">
            <ContactForm />
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-6">
          <div className="border border-line bg-surface-raised p-6">
            <h2 className="font-serif text-xl text-navy-900">School office</h2>

            {details.length > 0 ? (
              <dl className="mt-4 flex flex-col gap-4 text-sm">
                {details.map((row) => (
                  <div key={row.key} className="flex flex-col gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                      {row.label}
                    </dt>
                    <dd className="whitespace-pre-line text-navy-900">
                      {row.scheme === "tel" ? (
                        <a
                          href={`tel:${row.value.replace(/\s+/g, "")}`}
                          className="hover:underline"
                        >
                          {row.value}
                        </a>
                      ) : row.scheme === "mailto" ? (
                        <a href={`mailto:${row.value}`} className="hover:underline">
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Alert tone="info" className="mt-4">
                The school&rsquo;s contact details will be published here
                shortly. In the meantime, please use the form and we will reply
                by email.
              </Alert>
            )}
          </div>

          {mapEmbedUrl ? (
            <div className="overflow-hidden border border-line">
              <iframe
                src={mapEmbedUrl}
                title="Map showing the location of the school"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="aspect-square w-full border-0"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
