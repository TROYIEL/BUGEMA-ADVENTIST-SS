/**
 * Shell for print views: no sidebar, no top bar — just the document.
 *
 * Lives outside the (dashboard) group so it inherits none of the working
 * chrome. It still sits behind proxy.ts, and every page here performs its own
 * permission check; the layout is not a security boundary.
 */
export default function PrintLayout({ children }: LayoutProps<"/print"> ) {
  return <div className="min-h-dvh bg-white text-ink-900 print:bg-white">{children}</div>;
}
