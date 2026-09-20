"use server";

import { z } from "zod";

import { getClientIp } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getNotificationAddress, sendMail } from "@/lib/mail";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.email("Enter a valid email address.").max(254),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(3, "Enter a subject.").max(160),
  message: z
    .string()
    .trim()
    .min(20, "Please give us a little more detail (at least 20 characters).")
    .max(4000),
});

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof enquirySchema>, string>>;
  /** Echoed back so a rejected submission does not lose what was typed. */
  values?: Record<string, string>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function submitEnquiry(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: a field hidden from people but filled in by naive bots. Answer
  // with the ordinary success message so a bot learns nothing from the reply.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { status: "success", message: "Thank you — your message has been sent." };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  const parsed = enquirySchema.safeParse(raw);

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    return {
      status: "error",
      fieldErrors: {
        name: flattened.fieldErrors.name?.[0],
        email: flattened.fieldErrors.email?.[0],
        phone: flattened.fieldErrors.phone?.[0],
        subject: flattened.fieldErrors.subject?.[0],
        message: flattened.fieldErrors.message?.[0],
      },
      values: raw,
    };
  }

  const ip = (await getClientIp()) ?? "unknown";
  const limit = await rateLimit({
    key: `contact:${ip}`,
    ...RATE_LIMITS.contactForm,
  });

  if (!limit.ok) {
    return {
      status: "error",
      message:
        "You have sent several messages recently. Please try again later, or telephone the school office.",
      values: raw,
    };
  }

  const enquiry = await db.contactEnquiry.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      subject: parsed.data.subject,
      body: parsed.data.message,
      ipAddress: ip === "unknown" ? null : ip,
    },
    select: { id: true },
  });

  // The enquiry is already saved, so a mail failure cannot lose it. Staff will
  // still see it in the dashboard even if no notification goes out.
  const notify = await getNotificationAddress("enquiry");
  if (notify) {
    await sendMail({
      to: notify,
      subject: `Website enquiry: ${parsed.data.subject}`,
      relatedType: "contact_enquiry",
      relatedId: enquiry.id,
      html: `
        <p>A new enquiry was submitted through the website.</p>
        <p><strong>From:</strong> ${escapeHtml(parsed.data.name)} &lt;${escapeHtml(parsed.data.email)}&gt;</p>
        ${parsed.data.phone ? `<p><strong>Telephone:</strong> ${escapeHtml(parsed.data.phone)}</p>` : ""}
        <p><strong>Subject:</strong> ${escapeHtml(parsed.data.subject)}</p>
        <p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br>")}</p>
      `,
    });
  }

  return {
    status: "success",
    message:
      "Thank you — your message has been received. The school office will reply as soon as possible.",
  };
}
