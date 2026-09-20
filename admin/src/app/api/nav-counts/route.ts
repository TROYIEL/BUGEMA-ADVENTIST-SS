import { authErrorResponse, requirePermission } from "@/lib/auth/dal";
import { getNavCounts } from "@/lib/nav-counts";

export const dynamic = "force-dynamic";

/**
 * Fresh sidebar counts for the signed-in user. The layout renders the first
 * set on the server; the sidebar asks here again as the person moves around,
 * because a layout is not re-rendered on client-side navigation and the
 * numbers would otherwise only change on a full reload.
 */
export async function GET() {
  let user;
  try {
    user = await requirePermission("admin:access");
  } catch (error) {
    return authErrorResponse(error) ?? new Response("Error", { status: 500 });
  }

  return Response.json(await getNavCounts(user.role), {
    headers: { "Cache-Control": "no-store" },
  });
}
