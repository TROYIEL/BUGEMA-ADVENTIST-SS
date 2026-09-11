import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getCurrentUser } from "@bass/auth/dal";

export const metadata: Metadata = {
  title: "Sign in",
  // Never let the staff sign-in page into a search index.
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  // proxy.ts deliberately does not redirect away from this page on a stale
  // cookie; the real session check happens here, where the database is
  // reachable, so there is no redirect loop.
  const user = await getCurrentUser();
  if (user) redirect("/");

  const searchParams = await props.searchParams;
  const nextParam = searchParams.next;
  const next = typeof nextParam === "string" ? nextParam : undefined;

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-2">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-navy-600">
            <span aria-hidden="true" className="h-px w-8 bg-gold-500" />
            BASS administration
          </p>
          <h1 className="text-display-sm">Sign in</h1>
        </div>

        <LoginForm next={next} />
      </div>
    </main>
  );
}
