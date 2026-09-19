import { AnnouncementPlacement } from "@/generated/prisma/enums";

/** Labels for content editors — plain data, safe for client components. */

export const PLACEMENT_LABELS: Record<AnnouncementPlacement, string> = {
  [AnnouncementPlacement.GLOBAL]: "Everywhere",
  [AnnouncementPlacement.HOMEPAGE]: "Homepage",
  [AnnouncementPlacement.ADMISSIONS]: "Admissions pages",
  [AnnouncementPlacement.ACADEMICS]: "Academics pages",
};
