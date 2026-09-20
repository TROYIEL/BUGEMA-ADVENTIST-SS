import { ViewTransition } from "react";

/**
 * Re-mounted on every navigation (unlike the layout), which is what lets
 * the outgoing page animate out and the incoming one animate in. The
 * animations themselves live in tokens.css under the class names below;
 * `default="none"` keeps unrelated transitions — a form action, a filter —
 * from re-running them.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div className="min-w-0">{children}</div>
    </ViewTransition>
  );
}
