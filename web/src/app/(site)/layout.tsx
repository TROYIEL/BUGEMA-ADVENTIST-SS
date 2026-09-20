import { Suspense } from "react";

import { getSiteSettings, readSetting } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";

import { JsonLdScript, organisationJsonLd, websiteJsonLd } from "@/components/seo/json-ld";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { NavigationProgress } from "@/components/site/navigation-progress";
import { SiteFooter, getBrandLogo } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/**
 * Shell for the public website.
 *
 * The admin area lives outside this route group, so it never inherits the
 * public header and footer. The `(site)` group adds nothing to the URL.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  // Resolved once here rather than in both the header and the footer.
  const [logo, settings] = await Promise.all([getBrandLogo(), getSiteSettings()]);

  const siteUrl = getSiteUrl();
  const schoolName = readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";

  // Organisation + website graph on every page. Only configured facts are
  // emitted; anything the school has not supplied is simply absent.
  const structuredData = [
    organisationJsonLd({
      siteUrl,
      name: schoolName,
      logoUrl: logo ? `/media/${logo.storageKey}` : null,
      telephone: readSetting(settings, "contact.phone"),
      email: readSetting(settings, "contact.email"),
      streetAddress: readSetting(settings, "contact.physicalAddress"),
      sameAs: [
        readSetting(settings, "social.facebook"),
        readSetting(settings, "social.instagram"),
        readSetting(settings, "social.x"),
        readSetting(settings, "social.youtube"),
        readSetting(settings, "social.linkedin"),
      ],
    }),
    websiteJsonLd({ siteUrl, name: schoolName }),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <JsonLdScript data={structuredData} />
      {/* useSearchParams needs a boundary for the statically rendered not-found route. */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <AnnouncementBar />
      <SiteHeader logo={logo} />
      {children}
      <SiteFooter logo={logo} />
    </div>
  );
}
