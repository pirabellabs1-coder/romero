import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

const SECRET = process.env.AUTH_SECRET || "romero-dev-secret-change-me-in-production";
const COOKIE = "rp_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

type Payload = {
  uid: number;
  email: string;
  exp: number;
};

function sign(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string): Payload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export type User = { id: number; email: string };

export async function login(email: string, password: string): Promise<User | null> {
  // CRITICAL: use the async getter so cold-start Blob restore runs before
  // we look up the user. /api/auth/login is an API route that doesn't go
  // through the root layout (which is where getDbAsync was being called),
  // so without this, login would consult the bundled seed DB and reject
  // the photographer's real credentials.
  const { getDbAsync } = await import("@/lib/db");
  const db = await getDbAsync();
  const row = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as { id: number; email: string; password_hash: string } | undefined;
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const token = sign({ uid: row.id, email: row.email, exp });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return { id: row.id, email: row.email };
}

export function logout() {
  cookies().delete(COOKIE);
}

export function getCurrentUser(): User | null {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  return { id: payload.uid, email: payload.email };
}

export function requireUser(): User {
  const u = getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean> {
  const { getDbAsync } = await import("@/lib/db");
  const db = await getDbAsync();
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(userId) as { password_hash: string } | undefined;
  if (!row) return false;
  const ok = await bcrypt.compare(oldPassword, row.password_hash);
  if (!ok) return false;
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
  return true;
}

export async function changeEmail(userId: number, password: string, newEmail: string): Promise<boolean> {
  const { getDbAsync } = await import("@/lib/db");
  const db = await getDbAsync();
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(userId) as { password_hash: string } | undefined;
  if (!row) return false;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return false;
  try {
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(newEmail.toLowerCase().trim(), userId);
    return true;
  } catch {
    return false;
  }
}
