import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  logout();
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
