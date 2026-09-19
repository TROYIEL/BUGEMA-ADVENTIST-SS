import { EnquiryStatus } from "@bass/db/enums";
import type { BadgeTone } from "@bass/ui/badge";

export const ENQUIRY_BADGES: Record<EnquiryStatus, { label: string; tone: BadgeTone }> = {
  [EnquiryStatus.UNREAD]: { label: "Unread", tone: "gold" },
  [EnquiryStatus.READ]: { label: "Read", tone: "neutral" },
  [EnquiryStatus.ARCHIVED]: { label: "Archived", tone: "info" },
  [EnquiryStatus.SPAM]: { label: "Spam", tone: "danger" },
};
