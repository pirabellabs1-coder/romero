import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
