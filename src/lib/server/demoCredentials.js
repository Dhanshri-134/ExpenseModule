import fs from "node:fs";
import path from "node:path";

const CREDENTIAL_FILE = path.join(process.cwd(), "supabase", "demo-seed-credentials.json");

export function readDemoCredentials() {
  if (!fs.existsSync(CREDENTIAL_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CREDENTIAL_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function writeDemoCredentials(items) {
  fs.writeFileSync(CREDENTIAL_FILE, JSON.stringify(items, null, 2));
}

export function findDemoCredentialByUserId(userId) {
  return readDemoCredentials().find((item) => item.userId === userId) || null;
}

export function upsertDemoCredential(credential) {
  const items = readDemoCredentials();
  const next = [...items.filter((item) => item.userId !== credential.userId), credential];
  writeDemoCredentials(next);
}

export function touchDemoCredentialSentAt(userId) {
  const items = readDemoCredentials();
  const next = items.map((item) =>
    item.userId === userId
      ? {
          ...item,
          password_sent_at: new Date().toISOString(),
        }
      : item
  );
  writeDemoCredentials(next);
}
