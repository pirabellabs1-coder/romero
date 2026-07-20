/**
 * GET /api/auth/instagram/start
 * ─────────────────────────────
 * Démarre le flow « Facebook Login for Business » qui aboutit à un token
 * Page Access Token long-lived (60 jours) + à l'Instagram Business
 * Account ID rattaché. Aucune saisie manuelle côté user.
 *
 * Prérequis plateforme (Vercel ENV) :
 *   • META_APP_ID
 *   • META_APP_SECRET   (utilisé côté callback pour l'échange)
 *
 * Permissions demandées :
 *   • instagram_basic
 *   • instagram_content_publish
 *   • pages_show_list
 *   • pages_read_engagement
 *   • business_management
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.redirect(
      new URL(
        "/admin/agents/marketing?tab=config&err=" +
          encodeURIComponent(
            "Application Meta non configurée côté plateforme (contactez le studio)."
          ),
        req.url
      )
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/instagram/callback`;
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", META_SCOPES);
  authUrl.searchParams.set("response_type", "code");

  const resp = NextResponse.redirect(authUrl.toString());
  resp.cookies.set("rp_meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  return resp;
}
