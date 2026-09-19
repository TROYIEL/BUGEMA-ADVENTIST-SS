import "dotenv/config";

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createPrismaClient } from "@/lib/db/client";
import { rateLimit } from "./rate-limit";

const db = createPrismaClient();
const testKeys: string[] = [];

function uniqueKey(label: string) {
  const key = `test:${label}:${Math.random().toString(36).slice(2)}`;
  testKeys.push(key);
  return key;
}

after(async () => {
  await db.rateLimit.deleteMany({ where: { key: { in: testKeys } } });
  await db.$disconnect();
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks", async () => {
    const key = uniqueKey("basic");

    const first = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    assert.equal(first.ok, true);
    assert.equal(first.remaining, 2);

    const second = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    assert.equal(second.ok, true);
    assert.equal(second.remaining, 1);

    const third = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    assert.equal(third.ok, true);
    assert.equal(third.remaining, 0);

    const fourth = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    assert.equal(fourth.ok, false, "fourth request must be blocked");
    assert.equal(fourth.remaining, 0);
    assert.ok(fourth.retryAfterSeconds > 0, "must report when to retry");
  });

  it("keeps separate keys independent", async () => {
    const a = uniqueKey("iso-a");
    const b = uniqueKey("iso-b");

    await rateLimit({ key: a, limit: 1, windowSeconds: 60 });
    const blockedA = await rateLimit({ key: a, limit: 1, windowSeconds: 60 });
    assert.equal(blockedA.ok, false);

    const freshB = await rateLimit({ key: b, limit: 1, windowSeconds: 60 });
    assert.equal(freshB.ok, true, "a different key must not inherit the block");
  });

  it("resets once the window has expired", async () => {
    const key = uniqueKey("window");

    await rateLimit({ key, limit: 1, windowSeconds: 60 });
    assert.equal((await rateLimit({ key, limit: 1, windowSeconds: 60 })).ok, false);

    // Age the window out rather than sleeping for it.
    await db.rateLimit.update({
      where: { key },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const afterExpiry = await rateLimit({ key, limit: 1, windowSeconds: 60 });
    assert.equal(afterExpiry.ok, true, "window must reset after expiry");
    assert.equal(afterExpiry.remaining, 0);
  });

  it("counts concurrent requests atomically", async () => {
    const key = uniqueKey("concurrent");

    // Ten simultaneous requests against a limit of 4 must yield exactly
    // 4 allowed. A read-then-write implementation would let extras through.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        rateLimit({ key, limit: 4, windowSeconds: 60 }),
      ),
    );

    const allowed = results.filter((result) => result.ok).length;
    assert.equal(allowed, 4, `expected exactly 4 allowed, got ${allowed}`);
  });
});
