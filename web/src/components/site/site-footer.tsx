import Link from "next/link";

import { NavigationMenu } from "@bass/db/enums";
import { BrandMark } from "@/components/site/brand-mark";
import type { MediaImageAsset } from "@/components/media-image";
import { getNavigation } from "@bass/core/navigation";
import { getSiteSettings, readSetting, type SettingKey } from "@bass/core/settings";
import { db } from "@bass/db";

const SOCIAL_LINKS: { key: SettingKey; label: string; path: string }[] = [
  {
    key: "social.facebook",
    label: "Facebook",
    path: "M13.5 9H11V7.5c0-.7.3-1 1-1h1.5V4h-2.2C8.8 4 8 5.4 8 7.3V9H6.5v2.5H8V20h3v-8.5h2.1L13.5 9Z",
  },
  {
    key: "social.instagram",
    label: "Instagram",
    path: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm4.5-2.8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  },
  {
    key: "social.x",
    label: "X",
    path: "M4 4h4.2l3.6 5 4.1-5H19l-5.7 6.8L20 20h-4.2l-3.9-5.4L7.4 20H4.7l6.1-7.3L4 4Z",
  },
  {
    key: "social.youtube",
    label: "YouTube",
    path: "M21 8.2a2.4 2.4 0 0 0-1.7-1.7C17.8 6 12 6 12 6s-5.8 0-7.3.5A2.4 2.4 0 0 0 3 8.2 25 25 0 0 0 2.6 12 25 25 0 0 0 3 15.8a2.4 2.4 0 0 0 1.7 1.7c1.5.5 7.3.5 7.3.5s5.8 0 7.3-.5a2.4 2.4 0 0 0 1.7-1.7 25 25 0 0 0 .4-3.8 25 25 0 0 0-.4-3.8ZM10.2 14.6V9.4L14.7 12l-4.5 2.6Z",
  },
  {
    key: "social.linkedin",
    label: "LinkedIn",
    path: "M6.9 8.5H4.2V20h2.7V8.5ZM5.5 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20 13.6c0-3-1.6-4.4-3.7-4.4a3.2 3.2 0 0 0-2.9 1.6h-.1V8.5H10.7V20h2.7v-5.7c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20H20v-6.4Z",
  },
];

export async function SiteFooter({ logo }: { logo: MediaImageAsset | null }) {
  const [settings, primary, secondary, legal] = await Promise.all([
    getSiteSettings(),
    getNavigation(NavigationMenu.FOOTER_PRIMARY),
    getNavigation(NavigationMenu.FOOTER_SECONDARY),
    getNavigation(NavigationMenu.LEGAL),
  ]);

  const schoolName =
    readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";
  const description = readSetting(settings, "footer.description");
  const copyrightHolder = readSetting(settings, "footer.copyright") ?? schoolName;

  // Only configured details are rendered — never an empty label or a
  // placeholder standing in for a real telephone number.
  const contactRows = (
    [
      ["contact.physicalAddress", null],
      ["contact.postalAddress", null],
      ["contact.phone", "tel"],
      ["contact.email", "mailto"],
    ] as const
  )
    .map(([key, scheme]) => ({ value: readSetting(settings, key), scheme }))
    .filter((row): row is { value: string; scheme: "tel" | "mailto" | null } =>
      Boolean(row.value),
    );

  const socials = SOCIAL_LINKS.map((social) => ({
    ...social,
    href: readSetting(settings, social.key),
  })).filter((social): social is typeof social & { href: string } =>
    Boolean(social.href),
  );

  const year = new Date().getFullYear();

  return (
    <footer className="on-dark mt-auto bg-navy-950 text-white">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.85fr))] lg:gap-10">
        <div className="flex flex-col gap-6">
          <BrandMark schoolName={schoolName} logo={logo} tone="dark" />
          {description ? (
            <p className="max-w-xs text-sm leading-relaxed text-navy-100">
              {description}
            </p>
          ) : null}
        </div>

        <FooterColumn title="Explore" items={primary} />
        <FooterColumn title="Admissions" items={secondary} />

        <div className="flex flex-col gap-4">
          <h2 className="font-serif text-lg text-white">Contact</h2>
          {contactRows.length > 0 ? (
            <ul className="flex flex-col gap-2.5 text-sm text-navy-100">
              {contactRows.map((row) => (
                <li key={row.value} className="whitespace-pre-line">
                  {row.scheme === "tel" ? (
                    <a href={`tel:${row.value.replace(/\s+/g, "")}`} className="hover:text-white hover:underline">
                      {row.value}
                    </a>
                  ) : row.scheme === "mailto" ? (
                    <a href={`mailto:${row.value}`} className="hover:text-white hover:underline">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-navy-200">
              Contact details will be published shortly.
            </p>
          )}
          <Link
            href="/contact"
            className="mt-1 inline-flex w-fit items-center gap-2 border-b-2 border-gold-500 pb-0.5 text-sm font-semibold text-white hover:border-gold-300"
          >
            Contact the school
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col-reverse gap-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-[0.8125rem] text-navy-200">
            © {year} {copyrightHolder}
          </p>

          {legal.length > 0 ? (
            <nav aria-label="Legal">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem]">
                {legal.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href as never}
                      className="text-navy-100 hover:text-white hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {socials.length > 0 ? (
            <ul className="flex items-center gap-2">
              {socials.map((social) => (
                <li key={social.key}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="grid size-9 place-items-center rounded-full text-navy-100 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <span className="sr-only">{social.label}</span>
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
                      <path d={social.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof getNavigation>>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-lg text-white">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href as never}
              className="text-sm text-navy-100 transition-colors hover:text-white hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kept out of the footer component so pages can query the logo once. */
export async function getBrandLogo(): Promise<MediaImageAsset | null> {
  const settings = await getSiteSettings();
  const logoId = readSetting(settings, "school.logo");
  if (!logoId) return null;

  return db.mediaAsset.findUnique({
    where: { id: logoId },
    select: { storageKey: true, alt: true, width: true, height: true, blurDataUrl: true },
  });
}
