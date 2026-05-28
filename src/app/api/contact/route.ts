import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { sendContactNotification } from "@/lib/mailer";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

type Body = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  date?: string;
  place?: string;
  message?: string;
  lang?: string;
  /** Honeypot — should be empty. If filled, the sender is a bot. */
  website?: string;
  /** Minimum elapsed ms since the form was rendered, anti-bot heuristic. */
  formAgeMs?: number;
};

function clean(v: unknown, max = 1000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function POST(req: Request) {
  // 1. Rate limit: 3 submissions per IP per 10 minutes
  const ip = clientIp(req);
  const rl = rateLimit(`contact:${ip}`, 3, 10 * 60_000);
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { ok: false, error: "Trop de demandes. Réessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  // 2. Honeypot — silently succeed (don't reveal it's a trap)
  if (body.website && body.website.trim().length > 0) {
    console.warn("[contact] Honeypot triggered from IP", ip);
    return NextResponse.json({ ok: true });
  }

  // 3. Form-age heuristic — humans take >2s to fill the form
  if (typeof body.formAgeMs === "number" && body.formAgeMs < 1500) {
    console.warn("[contact] Form-age too short from IP", ip, body.formAgeMs);
    return NextResponse.json({ ok: true });
  }

  const first_name = clean(body.firstName, 80);
  const last_name = clean(body.lastName, 80);
  const email = clean(body.email, 200);
  const message = clean(body.message, 5000);

  if (!first_name || !last_name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const phone = clean(body.phone, 50);
  const wedding_date = clean(body.date, 30);
  const place = clean(body.place, 200);
  const lang = body.lang === "en" ? "en" : "fr";

  // 4. Persist to DB. Postgres is always-on, no cold-start dance required.
  let saved = false;
  try {
    await execute(
      `INSERT INTO messages (first_name, last_name, email, phone, wedding_date, place, message, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [first_name, last_name, email, phone, wedding_date, place, message, lang]
    );
    saved = true;
  } catch (e) {
    console.error("[contact] DB save failed:", e);
  }

  // 5. Always try to send the email — that's the most important guarantee for the photographer.
  const mailResult = await sendContactNotification({
    firstName: first_name,
    lastName: last_name,
    email,
    phone,
    weddingDate: wedding_date,
    place,
    message,
    lang,
  }).catch((e) => {
    console.error("[contact] mail send failed:", e);
    return { sent: false as const, error: e instanceof Error ? e.message : "unknown" };
  });

  if (saved || mailResult.sent) {
    return NextResponse.json({ ok: true, saved, mailSent: mailResult.sent });
  }
  return NextResponse.json(
    { ok: false, error: "Could not save the message nor send the email. Please try again or contact us directly." },
    { status: 500 }
  );
}
