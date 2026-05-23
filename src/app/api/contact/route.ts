import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendContactNotification } from "@/lib/mailer";

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
};

function clean(v: unknown, max = 1000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
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

  getDb()
    .prepare(
      `INSERT INTO messages (first_name, last_name, email, phone, wedding_date, place, message, lang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(first_name, last_name, email, phone, wedding_date, place, message, lang);

  // Best-effort email notification — never blocks the success response if SMTP isn't configured.
  sendContactNotification({
    firstName: first_name,
    lastName: last_name,
    email,
    phone,
    weddingDate: wedding_date,
    place,
    message,
    lang,
  }).catch((e) => console.error("[contact] mail send failed:", e));

  return NextResponse.json({ ok: true });
}
