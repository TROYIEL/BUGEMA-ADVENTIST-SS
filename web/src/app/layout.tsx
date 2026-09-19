import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { getSiteSettings, readSetting } from "@/lib/settings";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  // themeColor belongs on the viewport export; inside `metadata` it has been
  // deprecated since Next 14.
  themeColor: "#0a2447",
  colorScheme: "light",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  const name =
    readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";
  const title =
    readSetting(settings, "seo.defaultTitle") ?? name;
  const template = readSetting(settings, "seo.titleTemplate") ?? `%s | ${name}`;
  const description = readSetting(settings, "seo.defaultDescription");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : null,
    title: { default: title, template },
    // Omitted entirely rather than filled with invented copy when the school
    // has not supplied a description.
    ...(description ? { description } : {}),
    applicationName: name,
    openGraph: {
      type: "website",
      siteName: name,
      title,
      ...(description ? { description } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Next 16 stopped overriding scroll-behavior during route transitions;
      // this attribute restores smooth in-page scrolling without hijacking
      // navigations.
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sourceSerif.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-surface font-sans text-ink-900 antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
