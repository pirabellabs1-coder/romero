import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Throttle login attempts to prevent brute-force / credential-stuffing.
  // 5 attempts per IP per 5 minutes is generous for a legitimate user
  // (one typo gives 4 retries) but stops automated attacks cold.
  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 5, 5 * 60_000);
  if (!rl.ok) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("error", "ratelimit");
    return NextResponse.redirect(url, 303);
  }

  const form = await req.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const from = String(form.get("from") || "/admin");

  const u = await login(email, password);
  if (!u) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("error", "1");
    if (from) url.searchParams.set("from", from);
    return NextResponse.redirect(url, 303);
  }
  const target = from.startsWith("/admin") ? from : "/admin";
  return NextResponse.redirect(new URL(target, req.url), 303);
}
