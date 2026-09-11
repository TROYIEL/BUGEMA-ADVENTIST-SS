import { AnnouncementBar } from "@/components/site/announcement-bar";
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
  const logo = await getBrandLogo();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AnnouncementBar />
      <SiteHeader logo={logo} />
      {children}
      <SiteFooter logo={logo} />
    </div>
  );
}
