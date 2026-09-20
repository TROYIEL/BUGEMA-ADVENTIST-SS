import { EnquiryStatus } from "@/generated/prisma/enums";
import type { BadgeTone } from "@/components/ui/badge";

export const ENQUIRY_BADGES: Record<EnquiryStatus, { label: string; tone: BadgeTone }> = {
  [EnquiryStatus.UNREAD]: { label: "Unread", tone: "gold" },
  [EnquiryStatus.READ]: { label: "Read", tone: "neutral" },
  [EnquiryStatus.REPLIED]: { label: "Replied", tone: "success" },
  [EnquiryStatus.ARCHIVED]: { label: "Archived", tone: "info" },
  [EnquiryStatus.SPAM]: { label: "Spam", tone: "danger" },
};
