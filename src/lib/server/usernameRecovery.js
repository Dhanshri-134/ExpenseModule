import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RECOVERY_FILE = path.join(process.cwd(), "supabase", "username-recovery-otp.json");
const OTP_TTL_MS = 10 * 60 * 1000;

function readRecoveryItems() {
  if (!fs.existsSync(RECOVERY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RECOVERY_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeRecoveryItems(items) {
  fs.writeFileSync(RECOVERY_FILE, JSON.stringify(items, null, 2));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function prune(items) {
  const now = Date.now();
  return items.filter((item) => {
    const expiresAt = new Date(item.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export function createUsernameRecoveryOtp({ email, role, userId, userName, userCode }) {
  const otp = makeOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const items = prune(readRecoveryItems()).filter(
    (item) => !(item.email === email && item.role === role)
  );

  items.push({
    email,
    role,
    userId,
    userName,
    userCode,
    otpHash: hashOtp(otp),
    expiresAt,
  });

  writeRecoveryItems(items);
  return { otp, expiresAt };
}

export function verifyUsernameRecoveryOtp({ email, role, otp }) {
  const items = prune(readRecoveryItems());
  const match = items.find((item) => item.email === email && item.role === role);
  const remaining = items.filter((item) => !(item.email === email && item.role === role));

  writeRecoveryItems(remaining);

  if (!match) return { ok: false, error: "otp_not_found" };
  if (match.otpHash !== hashOtp(otp)) return { ok: false, error: "invalid_otp" };

  return {
    ok: true,
    userId: match.userId,
    userName: match.userName,
    userCode: match.userCode,
  };
}
