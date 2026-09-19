import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

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
  themeColor: "#061733",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: {
    default: "BASS Administration",
    template: "%s · BASS Administration",
  },
  // Belt and braces alongside the X-Robots-Tag header set in next.config.ts.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sourceSerif.variable} h-full`}
    >
      <body className="min-h-full font-sans text-ink-900 antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
