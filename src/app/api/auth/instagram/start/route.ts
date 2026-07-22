/**
 * GET /api/auth/instagram/start
 * ─────────────────────────────
 * Démarre le flow « Instagram API avec connexion pro » (Instagram Login direct,
 * sans passer par Facebook Login). Renvoie un access_token Instagram long-lived
 * (60 jours) + l'ID du compte IG Business directement — sans résolution de Page.
 *
 * Prérequis plateforme (Vercel ENV) :
 *   • INSTAGRAM_APP_ID
 *   • INSTAGRAM_APP_SECRET   (utilisé côté callback pour l'échange)
 *
 * Permissions demandées (scopes IG API v2) :
 *   • instagram_business_basic
 *   • instagram_business_content_publish
 *   • instagram_business_manage_comments
 *   • instagram_business_manage_messages
 *   • instagram_business_manage_insights
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
  "instagram_business_manage_insights",
].join(",");

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // Strip défensif : retire BOM et espaces qui peuvent traîner selon comment
  // la var a été saisie (pipe PowerShell notamment ajoute un BOM UTF-8).
  const appId = process.env.INSTAGRAM_APP_ID?.replace(/^﻿/, "").trim();
  if (!appId) {
    return NextResponse.redirect(
      new URL(
        "/admin/agents/marketing?tab=config&err=" +
          encodeURIComponent(
            "Application Instagram non configurée côté plateforme (contactez le studio)."
          ),
        req.url
      )
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/instagram/callback`;
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("force_reauth", "true");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", IG_SCOPES);
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
