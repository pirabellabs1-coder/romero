/**
 * GET /api/auth/google/start
 * Kick off Google OAuth flow pour connecter Google Calendar à l'agent
 * WhatsApp. Redirige le navigateur vers l'écran de consentement Google.
 *
 * Sécurité :
 *   - Route protégée : nécessite un utilisateur admin authentifié.
 *   - Un `state` aléatoire est stocké en cookie httpOnly pour la
 *     validation dans le callback (protection CSRF).
 *   - Le client_id vient de la config de l'agent — jamais hardcodé.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAgent } from "@/lib/agents";
import { buildAuthUrl } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // ENV en priorité (config plateforme), fallback sur la config agent.
  const inst = await getAgent("whatsapp");
  const cfg = inst?.config as { google_client_id?: string } | undefined;
  const clientId = process.env.GOOGLE_CLIENT_ID || cfg?.google_client_id;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        "/admin/agents/whatsapp?tab=config&err=" +
          encodeURIComponent(
            "Configuration Google Cloud manquante côté plateforme (contactez le studio)."
          ),
        req.url
      )
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // State aléatoire pour CSRF protection.
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const authUrl = buildAuthUrl({ clientId, redirectUri, state });

  const resp = NextResponse.redirect(authUrl);
  resp.cookies.set("rp_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
  return resp;
}
