// Must be first: loads the repository-root .env before anything reads it.
import "@/lib/db/env-load";

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { UserRole } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/crypto";
import { describePasswordProblem } from "@/lib/auth/password-policy";
import { createPrismaClient } from "@/lib/db/client";

/**
 * Creates an administrator account.
 *
 * The first account created is always a SUPER_ADMIN; afterwards a role can be
 * chosen. Passwords are never accepted as command-line arguments, because argv
 * is visible to other processes on the machine and lands in shell history —
 * non-interactive use reads BASS_ADMIN_PASSWORD instead.
 *
 * Interactive:
 *   npm run create-admin
 *
 * Non-interactive (deployment, CI):
 *   BASS_ADMIN_PASSWORD='…' npm run create-admin -- \
 *     --name "Site Administrator" --email admin@example.com --password-from-env
 */

const db = createPrismaClient({ direct: true });

type Args = {
  email?: string;
  name?: string;
  role?: string;
  passwordFromEnv: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { passwordFromEnv: false };

  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split("=", 2);
    const value = inline ?? argv[i + 1];

    switch (flag) {
      case "--email":
        args.email = value;
        if (!inline) i++;
        break;
      case "--name":
        args.name = value;
        if (!inline) i++;
        break;
      case "--role":
        args.role = value;
        if (!inline) i++;
        break;
      case "--password-from-env":
        args.passwordFromEnv = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
    }
  }

  return args;
}

function printUsage() {
  console.log(`
Create a BASS administrator account.

  npm run create-admin                        interactive

  BASS_ADMIN_PASSWORD='…' npm run create-admin -- \\
    --name "Site Administrator" \\
    --email admin@example.com \\
    --password-from-env                       non-interactive

Options:
  --name <name>            Full name
  --email <address>        Email address (used to sign in)
  --role <ROLE>            ${Object.values(UserRole).join(" | ")}
                           Ignored for the first account, which is always SUPER_ADMIN.
  --password-from-env      Read the password from BASS_ADMIN_PASSWORD
`);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Reads a line without echoing it to the terminal. */
async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });

  // readline has no built-in masking, so suppress its echo while typing.
  const originalWrite = stdout.write.bind(stdout);
  let muted = false;
  (stdout as NodeJS.WriteStream).write = ((
    chunk: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    if (muted) return true;
    return (
      originalWrite as (c: string | Uint8Array, ...r: unknown[]) => boolean
    )(chunk, ...rest);
  }) as typeof stdout.write;

  originalWrite(question);
  muted = true;

  try {
    return await rl.question("");
  } finally {
    muted = false;
    (stdout as NodeJS.WriteStream).write = originalWrite;
    originalWrite("\n");
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // With stdin closed or piped, readline throws "readline was closed" on the
  // first prompt. Detect that up front and require flags instead, so scripted
  // provisioning fails with an actionable message rather than a stack trace.
  const interactive = Boolean(stdin.isTTY);

  const existingUsers = await db.user.count();
  const isFirstAccount = existingUsers === 0;

  // Validate everything that can be checked without prompting, before doing
  // any work — a bad password should fail immediately, not after four
  // questions.
  let envPassword: string | null = null;
  if (args.passwordFromEnv) {
    envPassword = process.env.BASS_ADMIN_PASSWORD ?? "";
    if (!envPassword) {
      throw new Error(
        "--password-from-env was given but BASS_ADMIN_PASSWORD is not set.",
      );
    }
    const problem = describePasswordProblem(envPassword);
    if (problem) throw new Error(problem);
  } else if (!interactive) {
    throw new Error(
      "No terminal available. Pass --password-from-env and set BASS_ADMIN_PASSWORD.",
    );
  }

  if (!interactive) {
    if (!args.name?.trim()) throw new Error("--name is required when there is no terminal.");
    if (!args.email?.trim()) throw new Error("--email is required when there is no terminal.");
  }

  console.log(
    isFirstAccount
      ? "\nCreating the first administrator (super administrator).\n"
      : `\nCreating an additional staff account (${existingUsers} already exist).\n`,
  );

  const rl = interactive
    ? createInterface({ input: stdin, output: stdout })
    : null;

  try {
    // --- Name -------------------------------------------------------------
    let name = args.name?.trim() ?? "";
    while (!name && rl) {
      name = (await rl.question("Full name: ")).trim();
      if (!name) console.error("  Name is required.");
    }

    // --- Email ------------------------------------------------------------
    let email = args.email?.trim().toLowerCase() ?? "";
    for (;;) {
      if (!email && rl) {
        email = (await rl.question("Email address: ")).trim().toLowerCase();
      }

      if (!isValidEmail(email)) {
        if (!rl) throw new Error(`"${email}" is not a valid email address.`);
        console.error("  That does not look like an email address.");
        email = "";
        continue;
      }

      const taken = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (taken) {
        if (!rl) throw new Error(`An account already exists for ${email}.`);
        console.error(`  An account already exists for ${email}.`);
        email = "";
        continue;
      }
      break;
    }

    // --- Role -------------------------------------------------------------
    const roles = Object.values(UserRole);
    let role: UserRole = UserRole.SUPER_ADMIN;

    if (!isFirstAccount) {
      const requested = args.role?.toUpperCase();

      if (requested) {
        if (!roles.includes(requested as UserRole)) {
          throw new Error(
            `Unknown role "${args.role}". Expected one of: ${roles.join(", ")}.`,
          );
        }
        role = requested as UserRole;
      } else if (rl) {
        console.log(`\n  Roles: ${roles.join(", ")}`);
        for (;;) {
          const answer = (await rl.question("Role [ADMIN]: ")).trim().toUpperCase();
          if (!answer) {
            role = UserRole.ADMIN;
            break;
          }
          if (roles.includes(answer as UserRole)) {
            role = answer as UserRole;
            break;
          }
          console.error("  Unknown role.");
        }
      } else {
        role = UserRole.ADMIN;
      }
    }

    // --- Password ---------------------------------------------------------
    let password: string;

    if (envPassword) {
      password = envPassword;
    } else {
      for (;;) {
        password = await promptHidden("Password: ");
        const problem = describePasswordProblem(password);
        if (problem) {
          console.error(`  ${problem}`);
          continue;
        }
        if ((await promptHidden("Confirm password: ")) !== password) {
          console.error("  Passwords do not match.");
          continue;
        }
        break;
      }
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        role,
        passwordHash: await hashPassword(password),
        isActive: true,
      },
      select: { id: true, email: true, role: true },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "created",
        entityType: "user",
        entityId: user.id,
        newValue: { email: user.email, role: user.role },
        note: "Created from the command line",
      },
    });

    console.log(`\n  Created ${user.email} as ${user.role}.`);
    console.log("  Sign in to the administration app (http://localhost:3001 in development)\n");
  } finally {
    rl?.close();
  }
}

main()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
