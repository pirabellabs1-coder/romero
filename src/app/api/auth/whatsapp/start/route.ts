/**
 * GET /api/auth/whatsapp/start
 * ────────────────────────────
 * Démarre le flow Meta OAuth avec les scopes WhatsApp Business.
 * Le callback résout auto la WABA + phone_number_id + access_token
 * du user, stocke tout dans studio_settings.
 *
 * ⚠️ Prérequis côté Meta : l'user doit avoir déjà créé une WhatsApp
 * Business Account dans son Meta Business Portfolio et validé un
 * numéro téléphonique. Sans ça, le callback ne trouvera aucune WABA
 * et affichera un message d'erreur explicatif.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_WA_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
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
        "/admin/agents/studio?err=" +
          encodeURIComponent(
            "Application Meta non configurée côté plateforme (contactez le studio)."
          ),
        req.url
      )
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/whatsapp/callback`;
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", META_WA_SCOPES);
  authUrl.searchParams.set("response_type", "code");

  const resp = NextResponse.redirect(authUrl.toString());
  resp.cookies.set("rp_meta_wa_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  return resp;
}
