import "server-only";

import { EmailStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { getSiteSettings, readSetting } from "./settings";

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
  /** Where a reply from the recipient should go, when not the sender. */
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  /** Links the message back to an application, enquiry, etc. */
  relatedType?: string;
  relatedId?: string;
};

export type MailResult = {
  /** The outbox row, so a caller can link to it or show its fate later. */
  id: string;
  /** Whether the message was actually handed to a mail server. */
  delivered: boolean;
  /** Always true once the message is safely recorded. */
  queued: boolean;
  driver: string;
  error?: string;
};

export interface MailDriver {
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
      replyTo: message.replyTo,
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
      replyTo: message.replyTo,
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

    return { id: record.id, delivered, queued: true, driver: driver.name };
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
    return { id: record.id, delivered: false, queued: true, driver: driver.name, error: reason };
  }
}

export type FlushOutboxOptions = {
  /** Only these rows. Used by tests and by a per-message retry. */
  ids?: string[];
  /** Rows per run, oldest first. */
  limit?: number;
  /** Rows that have already been attempted this many times are left alone. */
  maxAttempts?: number;
};

export type FlushOutboxResult = {
  driver: string;
  /** Rows that were eligible and got another attempt. */
  attempted: number;
  sent: number;
  failed: number;
  /** Rows another flush claimed first, or that the driver recorded but did not deliver. */
  skipped: number;
  /** Why nothing was attempted, when that is the case. */
  reason?: string;
};

export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * Re-attempts delivery of QUEUED and FAILED outbox rows.
 *
 * `sendMail` tries exactly once at the moment of sending, so an SMTP outage
 * leaves rows behind. This is what a cron job or the `mail:flush` script
 * calls to pick them up. Each row is claimed by bumping `attempts` under an
 * optimistic check first, so two overlapping flushes can never deliver the
 * same message twice.
 *
 * With no SMTP configured nothing can leave, so nothing is attempted: the
 * outbox stays intact for the day the mail server is set up, rather than
 * being burned down to the attempt cap.
 */
export async function flushOutbox(options: FlushOutboxOptions = {}): Promise<FlushOutboxResult> {
  const driver = createDriver();
  if (driver.name !== "smtp") {
    return {
      driver: driver.name,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      reason: `MAIL_DRIVER is "${driver.name}", which records mail without delivering it.`,
    };
  }
  return flushOutboxWith(driver, options);
}

/** The flush itself, with the driver injected so it can be exercised in tests. */
export async function flushOutboxWith(
  driver: MailDriver,
  options: FlushOutboxOptions = {},
): Promise<FlushOutboxResult> {
  const limit = options.limit ?? 50;
  const maxAttempts = options.maxAttempts ?? OUTBOX_MAX_ATTEMPTS;
  const result: FlushOutboxResult = { driver: driver.name, attempted: 0, sent: 0, failed: 0, skipped: 0 };

  const rows = await db.emailOutbox.findMany({
    where: {
      status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] },
      attempts: { lt: maxAttempts },
      ...(options.ids ? { id: { in: options.ids } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of rows) {
    // Claim the row: the update only lands if nobody else has touched it
    // since we read it, so a concurrent flush skips it instead of re-sending.
    const claimed = await db.emailOutbox.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      result.skipped += 1;
      continue;
    }
    result.attempted += 1;

    const message: MailMessage = {
      to: row.toAddress,
      toName: row.toName ?? undefined,
      replyTo: row.replyTo ?? undefined,
      subject: row.subject,
      html: row.html,
      text: row.text ?? undefined,
      relatedType: row.relatedType ?? undefined,
      relatedId: row.relatedId ?? undefined,
    };

    try {
      const delivered = await driver.send(message);
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: delivered ? EmailStatus.SENT : EmailStatus.QUEUED,
          sentAt: delivered ? new Date() : null,
          lastError: null,
        },
      });
      if (delivered) result.sent += 1;
      else result.skipped += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: EmailStatus.FAILED, lastError: reason.slice(0, 1000) },
      });
      result.failed += 1;
      console.error(`[mail] retry failed for "${row.subject}":`, reason);
    }
  }

  return result;
}

/** Whether mail can actually leave the building, for honest UI copy. */
export function isMailDeliveryConfigured(): boolean {
  return process.env.MAIL_DRIVER === "smtp" && Boolean(process.env.SMTP_HOST);
}

/** Fallback address from the environment, for a deployment with no settings yet. */
export function getAdminNotificationAddress(): string | null {
  const address = process.env.MAIL_ADMIN_NOTIFICATIONS?.trim();
  return address ? address : null;
}

export type NotificationKind = "enquiry" | "application";

/**
 * Where the school wants to be told about something. Configured by the
 * school under Site settings; the environment variable remains as a
 * fallback so a fresh deployment is never silent. New applications fall
 * back to the public admissions address before that, since that inbox
 * exists whenever admissions are open at all.
 */
export async function getNotificationAddress(kind: NotificationKind): Promise<string | null> {
  const settings = await getSiteSettings();
  const configured =
    kind === "enquiry"
      ? readSetting(settings, "contact.notificationEmail")
      : (readSetting(settings, "admissions.notificationEmail") ?? readSetting(settings, "admissions.email"));
  return configured ?? getAdminNotificationAddress();
}

/** Absolute URL for links inside outgoing mail, which has no origin of its own. */
export function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
