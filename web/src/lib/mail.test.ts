import "dotenv/config";

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { EmailStatus } from "@/generated/prisma/enums";
import { createPrismaClient } from "@/lib/db/client";

import { flushOutboxWith, type MailDriver, type MailMessage } from "./mail";

const db = createPrismaClient();

// Every row this file creates is addressed here, and only rows passed by id
// are ever flushed, so real queued mail in a shared database is never touched.
const TO = "zz-mail-test@bass.example.com";
const created: string[] = [];

async function queue(subject: string, extra: { status?: EmailStatus; attempts?: number } = {}) {
  const row = await db.emailOutbox.create({
    data: {
      toAddress: TO,
      subject: `zz-mail-test ${subject}`,
      html: `<p>${subject}</p>`,
      status: extra.status ?? EmailStatus.QUEUED,
      attempts: extra.attempts ?? 0,
    },
    select: { id: true },
  });
  created.push(row.id);
  return row.id;
}

function fakeDriver(failFor: (message: MailMessage) => boolean = () => false): MailDriver & { sent: string[] } {
  const sent: string[] = [];
  return {
    name: "fake",
    sent,
    async send(message) {
      if (failFor(message)) throw new Error("connection refused");
      sent.push(message.subject);
      return true;
    },
  };
}

after(async () => {
  await db.emailOutbox.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("flushOutbox", () => {
  it("delivers queued and failed rows and records the outcome", async () => {
    const queued = await queue("queued");
    const failed = await queue("failed", { status: EmailStatus.FAILED, attempts: 1 });
    const driver = fakeDriver();

    const result = await flushOutboxWith(driver, { ids: [queued, failed] });

    assert.deepEqual(
      { attempted: result.attempted, sent: result.sent, failed: result.failed, skipped: result.skipped },
      { attempted: 2, sent: 2, failed: 0, skipped: 0 },
    );
    assert.equal(driver.sent.length, 2);

    const rows = await db.emailOutbox.findMany({ where: { id: { in: [queued, failed] } } });
    for (const row of rows) {
      assert.equal(row.status, EmailStatus.SENT);
      assert.ok(row.sentAt);
      assert.equal(row.lastError, null);
    }
    assert.equal(rows.find((r) => r.id === failed)?.attempts, 2);
  });

  it("marks a row FAILED with the error when delivery throws, and leaves the rest", async () => {
    const good = await queue("good");
    const bad = await queue("bad");
    const driver = fakeDriver((m) => m.subject.endsWith("bad"));

    const result = await flushOutboxWith(driver, { ids: [good, bad] });
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);

    const row = await db.emailOutbox.findUniqueOrThrow({ where: { id: bad } });
    assert.equal(row.status, EmailStatus.FAILED);
    assert.equal(row.attempts, 1);
    assert.equal(row.lastError, "connection refused");
  });

  it("gives up on rows that have reached the attempt cap", async () => {
    const exhausted = await queue("exhausted", { status: EmailStatus.FAILED, attempts: 5 });
    const driver = fakeDriver();

    const result = await flushOutboxWith(driver, { ids: [exhausted] });
    assert.equal(result.attempted, 0);
    assert.equal(driver.sent.length, 0);

    const row = await db.emailOutbox.findUniqueOrThrow({ where: { id: exhausted } });
    assert.equal(row.status, EmailStatus.FAILED);
    assert.equal(row.attempts, 5);
  });

  it("never delivers a row twice when two flushes overlap", async () => {
    const ids = await Promise.all([queue("race-1"), queue("race-2"), queue("race-3")]);
    const a = fakeDriver();
    const b = fakeDriver();

    const [ra, rb] = await Promise.all([
      flushOutboxWith(a, { ids }),
      flushOutboxWith(b, { ids }),
    ]);

    assert.equal(ra.sent + rb.sent, 3);
    assert.equal(a.sent.length + b.sent.length, 3);
    const rows = await db.emailOutbox.findMany({ where: { id: { in: ids } } });
    for (const row of rows) {
      assert.equal(row.status, EmailStatus.SENT);
      assert.equal(row.attempts, 1);
    }
  });

  it("does not touch rows that were already sent", async () => {
    const sent = await queue("already", { status: EmailStatus.SENT });
    const driver = fakeDriver();
    const result = await flushOutboxWith(driver, { ids: [sent] });
    assert.equal(result.attempted, 0);
    assert.equal(driver.sent.length, 0);
  });
});
