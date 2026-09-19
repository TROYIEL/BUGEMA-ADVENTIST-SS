// Must be first: loads the repository-root .env before anything reads it.
import "@/lib/db/env-load";

import { generateToken, hashPassword, hashToken } from "@/lib/auth/crypto";
import { createPrismaClient } from "@/lib/db/client";

/**
 * Issues or removes the throwaway administrator the end-to-end scripts sign
 * in as. See scripts/e2e/lib/session.mjs.
 */
const db = createPrismaClient();
const EMAIL = "zz-e2e@bass.example.com";

async function main() {
  if (process.argv[2] === "cleanup") {
    const user = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    if (user) {
      await db.session.deleteMany({ where: { userId: user.id } });
      await db.auditLog.deleteMany({ where: { actorUserId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    return;
  }

  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      email: EMAIL,
      name: "ZZ end-to-end (temporary)",
      role: "SUPER_ADMIN",
      passwordHash: await hashPassword(generateToken()),
    },
    select: { id: true },
  });
  const token = generateToken();
  await db.session.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 2 * 3600_000) },
  });
  console.log(token);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
