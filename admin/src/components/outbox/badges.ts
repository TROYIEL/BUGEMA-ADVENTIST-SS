import { EmailStatus } from "@/generated/prisma/enums";
import type { BadgeTone } from "@/components/ui/badge";

export const OUTBOX_BADGES: Record<EmailStatus, { label: string; tone: BadgeTone }> = {
  [EmailStatus.QUEUED]: { label: "Queued", tone: "gold" },
  [EmailStatus.SENT]: { label: "Sent", tone: "success" },
  [EmailStatus.FAILED]: { label: "Failed", tone: "danger" },
};
