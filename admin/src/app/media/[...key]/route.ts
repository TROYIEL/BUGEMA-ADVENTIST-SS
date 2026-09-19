import type { NextRequest } from "next/server";

import { serveMedia } from "@/lib/media-route";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/media/[...key]">,
) {
  const { key } = await context.params;
  return serveMedia(Array.isArray(key) ? key.join("/") : key);
}
