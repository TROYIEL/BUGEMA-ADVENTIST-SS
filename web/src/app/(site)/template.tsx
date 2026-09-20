import { ViewTransition } from "react";

/**
 * Re-mounted on every navigation (unlike the layout, which keeps the header
 * and footer in place), so the outgoing page can animate out and the
 * incoming one in. The animations live in tokens.css under these class
 * names; `default="none"` keeps unrelated transitions from re-running them.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
