import "server-only";

import { EmailStatus } from "@bass/db/enums";
import { db } from "@bass/db";

/**
 * Outgoing mail.
 *
 * Every message is written to the `email_outbox` table BEFORE any delivery is
 * attempted, and the row records what actually happened. With no SMTP
 * configured the outbox is the whole mail system: the admin UI shows the queue
 * and says plainly that nothing was delivered, rather than showing a
 * "confirmation email sent" message that is not true.
 */

export type MailMessage = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  /** Links the message back to an application, enquiry, etc. */
  relatedType?: string;
  relatedId?: string;
};

export type MailResult = {
  /** Whether the message was actually handed to a mail server. */
  delivered: boolean;
  /** Always true once the message is safely recorded. */
  queued: boolean;
  driver: string;
  error?: string;
};

interface MailDriver {
  readonly name: string;
  /** Returns true when the message was genuinely handed off for delivery. */
  send(message: MailMessage): Promise<boolean>;
}

/** Records the message and nothing else. The safe default. */
class OutboxDriver implements MailDriver {
  readonly name = "outbox";
  async send(): Promise<boolean> {
    return false;
  }
}

/** Records the message and prints it, for local development. */
class ConsoleDriver implements MailDriver {
  readonly name = "console";
  async send(message: MailMessage): Promise<boolean> {
    console.info(
      `\n──────── mail (not delivered; MAIL_DRIVER=console) ────────\n` +
        `To:      ${message.toName ? `${message.toName} <${message.to}>` : message.to}\n` +
        `Subject: ${message.subject}\n` +
        `${message.text ?? stripHtml(message.html)}\n` +
        `───────────────────────────────────────────────────────────\n`,
    );
    return false;
  }
}

class SmtpDriver implements MailDriver {
  readonly name = "smtp";

  async send(message: MailMessage): Promise<boolean> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error(
        'MAIL_DRIVER is "smtp" but SMTP_HOST is not set. Configure the SMTP_* variables or set MAIL_DRIVER=outbox.',
      );
    }

    // Imported lazily so projects running without SMTP never load nodemailer.
    const { createTransport } = await import("nodemailer");

    const transport = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD ?? "",
          }
        : undefined,
    });

    await transport.sendMail({
      from: {
        name: process.env.MAIL_FROM_NAME ?? "Bugema Adventist Secondary School",
        address: process.env.MAIL_FROM_ADDRESS ?? "no-reply@example.invalid",
      },
      to: message.toName
        ? { name: message.toName, address: message.to }
        : message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? stripHtml(message.html),
    });

    return true;
  }
}

function createDriver(): MailDriver {
  switch (process.env.MAIL_DRIVER) {
    case "smtp":
      return new SmtpDriver();
    case "console":
      return new ConsoleDriver();
    case "outbox":
    case undefined:
    case "":
      return new OutboxDriver();
    default:
      throw new Error(
        `Unknown MAIL_DRIVER "${process.env.MAIL_DRIVER}". Expected "outbox", "console" or "smtp".`,
      );
  }
}

/**
 * Persists and attempts to deliver a message.
 *
 * Never throws on a delivery failure: an SMTP outage must not roll back an
 * application submission. The failure is recorded on the outbox row and
 * surfaced in the admin UI instead.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const driver = createDriver();

  const record = await db.emailOutbox.create({
    data: {
      toAddress: message.to,
      toName: message.toName,
      subject: message.subject,
      html: message.html,
      text: message.text ?? stripHtml(message.html),
      relatedType: message.relatedType,
      relatedId: message.relatedId,
      status: EmailStatus.QUEUED,
    },
    select: { id: true },
  });

  try {
    const delivered = await driver.send(message);

    await db.emailOutbox.update({
      where: { id: record.id },
      data: {
        status: delivered ? EmailStatus.SENT : EmailStatus.QUEUED,
        attempts: { increment: 1 },
        sentAt: delivered ? new Date() : null,
      },
    });

    return { delivered, queued: true, driver: driver.name };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    await db.emailOutbox.update({
      where: { id: record.id },
      data: {
        status: EmailStatus.FAILED,
        attempts: { increment: 1 },
        lastError: reason.slice(0, 1000),
      },
    });

    console.error(`[mail] delivery failed for "${message.subject}":`, reason);
    return { delivered: false, queued: true, driver: driver.name, error: reason };
  }
}

/** Whether mail can actually leave the building, for honest UI copy. */
export function isMailDeliveryConfigured(): boolean {
  return process.env.MAIL_DRIVER === "smtp" && Boolean(process.env.SMTP_HOST);
}

/** Address that receives new-application and new-enquiry notifications. */
export function getAdminNotificationAddress(): string | null {
  const address = process.env.MAIL_ADMIN_NOTIFICATIONS?.trim();
  return address ? address : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
