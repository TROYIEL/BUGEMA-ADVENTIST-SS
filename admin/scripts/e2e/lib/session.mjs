import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * A throwaway SUPER_ADMIN session, and its removal.
 *
 * The account is named with a `zz-e2e` prefix and is deleted — together with
 * its sessions and audit entries, and nothing else — when the run finishes.
 * Test code must only ever touch rows it created itself: the database is
 * shared with whoever is trying the system at the same time.
 */
export function issueAdminSession() {
  const out = execFileSync(
    "node",
    ["--conditions=react-server", "--import", "tsx", "scripts/e2e-session.ts", "issue"],
    { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return out.trim().split("\n").pop();
}

export function revokeAdminSession() {
  execFileSync(
    "node",
    ["--conditions=react-server", "--import", "tsx", "scripts/e2e-session.ts", "cleanup"],
    { cwd: projectRoot, stdio: "ignore" },
  );
}
