/**
 * GET /api/auth/google/signin/start
 * ─────────────────────────────────
 * Démarre un flow Google OAuth SSO minimal (email + profil, PAS de
 * calendar) pour se connecter à /admin sans mot de passe.
 *
 * Distinct de /api/auth/google/start (qui, lui, obtient un
 * refresh_token Calendar pour l'agent WhatsApp).
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        "/admin/login?error=" +
          encodeURIComponent("Configuration Google absente côté plateforme."),
        req.url
      )
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/signin/callback`;
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  // On propage le `from` pour rediriger l'utilisateur après signin
  const from = req.nextUrl.searchParams.get("from") ?? "/admin";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("include_granted_scopes", "true");

  const resp = NextResponse.redirect(authUrl.toString());
  resp.cookies.set("rp_google_signin_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  resp.cookies.set("rp_google_signin_from", from, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  return resp;
}
