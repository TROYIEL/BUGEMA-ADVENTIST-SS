import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateToken,
  hashPassword,
  hashToken,
  safeEqual,
  verifyPassword,
} from "./crypto";

describe("password hashing", () => {
  it("produces a self-describing hash carrying its parameters", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-1");
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
  });

  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-1");
    assert.equal(await verifyPassword("Correct-Horse-Battery-1", hash), true);
    assert.equal(await verifyPassword("Correct-Horse-Battery-2", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  it("salts each hash, so identical passwords differ on disk", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same-password", a), true);
    assert.equal(await verifyPassword("same-password", b), true);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    assert.equal(await verifyPassword("x", "garbage"), false);
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", "scrypt$32768$8$1$abc"), false);
    assert.equal(await verifyPassword("x", "argon2$1$2$3$4$5"), false);
  });

  it("round-trips non-ASCII passwords", async () => {
    const password = "pässword-ｎｏｒｍ-Ω";
    assert.equal(await verifyPassword(password, await hashPassword(password)), true);
  });
});

describe("tokens", () => {
  it("generates url-safe tokens with 256 bits of entropy", () => {
    const token = generateToken();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.equal(Buffer.from(token, "base64url").length, 32);
  });

  it("does not repeat", () => {
    assert.notEqual(generateToken(), generateToken());
  });

  it("hashes tokens stably to sha256 hex", () => {
    const token = generateToken();
    assert.equal(hashToken(token), hashToken(token));
    assert.match(hashToken(token), /^[0-9a-f]{64}$/);
    assert.notEqual(hashToken(token), hashToken(generateToken()));
  });
});

describe("safeEqual", () => {
  it("compares equal strings as equal", () => {
    assert.equal(safeEqual("abc", "abc"), true);
  });

  it("rejects different strings and different lengths", () => {
    assert.equal(safeEqual("abc", "abd"), false);
    assert.equal(safeEqual("abc", "abcd"), false);
    assert.equal(safeEqual("", "a"), false);
  });
});
