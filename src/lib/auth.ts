import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { execute, queryOne } from "@/lib/db";

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

/**
 * Login via Google SSO — cherche l'utilisateur par email. Si trouvé,
 * pose la session cookie. Si non trouvé mais que l'email est dans la
 * whitelist ADMIN_ALLOWED_EMAILS (env, séparés par virgules), auto-
 * provisionne un compte avec un password aléatoire (jamais utilisé).
 * Retourne null si l'email n'est pas autorisé.
 */
export async function loginWithGoogle(email: string): Promise<User | null> {
  const clean = email.toLowerCase().trim();
  if (!clean) return null;

  let row = await queryOne<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE email = $1",
    [clean]
  );

  if (!row) {
    // Auto-provision si dans la whitelist
    const whitelist = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!whitelist.includes(clean)) return null;

    const randomPw = crypto.randomBytes(24).toString("base64url");
    const hash = await bcrypt.hash(randomPw, 10);
    await execute(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
      [clean, hash]
    );
    row = await queryOne<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE email = $1",
      [clean]
    );
    if (!row) return null;
  }

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

export async function login(email: string, password: string): Promise<User | null> {
  const row = await queryOne<{ id: number; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );
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

export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const row = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  if (!row) return false;
  const ok = await bcrypt.compare(oldPassword, row.password_hash);
  if (!ok) return false;
  const hash = await bcrypt.hash(newPassword, 10);
  await execute("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
  return true;
}

export async function changeEmail(
  userId: number,
  password: string,
  newEmail: string
): Promise<boolean> {
  const row = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  if (!row) return false;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return false;
  try {
    await execute("UPDATE users SET email = $1 WHERE id = $2", [
      newEmail.toLowerCase().trim(),
      userId,
    ]);
    return true;
  } catch {
    return false;
  }
}
