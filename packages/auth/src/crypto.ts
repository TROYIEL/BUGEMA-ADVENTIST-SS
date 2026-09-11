import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// node:util's promisify types only expose scrypt's 3-argument overload, which
// drops the options object we need to raise maxmem. Wrap it explicitly.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

// scrypt ships with Node, so there is no native build step and no third-party
// hashing dependency to keep patched.
const KEY_LENGTH = 64;
const SCRYPT_N = 32768; // 2^15
const SCRYPT_R = 8;
const SCRYPT_P = 1;
// scrypt needs roughly 128 * N * r bytes; Node's default maxmem (32 MB) is
// below that for N = 2^15 and would throw.
const SCRYPT_MAXMEM = 96 * 1024 * 1024;

const SCRYPT_OPTIONS = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: SCRYPT_MAXMEM,
} as const;

/**
 * Hashes a password into a self-describing string:
 *   scrypt$N$r$p$<base64 salt>$<base64 hash>
 * Storing the parameters means they can be raised later without invalidating
 * existing hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    SCRYPT_OPTIONS,
  );

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/** Constant-time password check. Returns false rather than throwing on a malformed hash. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw, "base64");
    expected = Buffer.from(hashRaw, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * A URL-safe secret for session cookies, applicant portal links and draft
 * resume links. 32 bytes of CSPRNG output.
 */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/**
 * Only the hash of a token is ever stored, so a database leak does not hand an
 * attacker working session cookies or portal links.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex/ASCII strings of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Stable checksum used to spot duplicate uploads in the media library. */
export function checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
