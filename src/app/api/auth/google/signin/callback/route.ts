/**
 * GET /api/auth/google/signin/callback
 * ────────────────────────────────────
 * Reçoit le code Google SSO, l'échange contre un access_token, récupère
 * l'email/profil du user, puis pose la session admin via loginWithGoogle.
 *
 * Écrit aussi email → studio_settings.notification_email s'il n'est pas
 * déjà renseigné (auto-remplissage pratique).
 */
import { NextRequest, NextResponse } from "next/server";
import { loginWithGoogle } from "@/lib/auth";
import { getSharedConfig, writeSharedKey } from "@/lib/studio-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    return {
      ok: false,
      error: json.error_description ?? json.error ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true, accessToken: json.access_token };
}

async function fetchProfile(
  accessToken: string
): Promise<{ email?: string; name?: string } | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as { email?: string; name?: string };
  } catch {
    return null;
  }
}

function fail(req: NextRequest, msg: string): NextResponse {
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("error", msg);
  const r = NextResponse.redirect(url);
  r.cookies.delete("rp_google_signin_state");
  r.cookies.delete("rp_google_signin_from");
  return r;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const errorParam = params.get("error");

  if (errorParam) return fail(req, `Autorisation refusée : ${errorParam}`);
  if (!code) return fail(req, "Code Google manquant.");

  const cookieState = req.cookies.get("rp_google_signin_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return fail(req, "State SSO invalide (protection CSRF).");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail(req, "Configuration Google absente côté plateforme.");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/signin/callback`;

  const exchange = await exchangeCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });
  if (!exchange.ok) return fail(req, `Échange OAuth échoué : ${exchange.error}`);

  const profile = await fetchProfile(exchange.accessToken);
  if (!profile?.email) {
    return fail(req, "Impossible de récupérer l'email Google.");
  }

  const user = await loginWithGoogle(profile.email);
  if (!user) {
    return fail(
      req,
      `L'adresse ${profile.email} n'est pas autorisée à accéder à l'admin.`
    );
  }

  // Auto-remplissage : si notification_email n'est pas encore défini
  // dans studio_settings, on met l'email du user comme défaut pratique.
  try {
    const shared = await getSharedConfig();
    if (!shared.notification_email) {
      await writeSharedKey("notification_email", profile.email);
    }
  } catch {
    // Non-bloquant.
  }

  const from = req.cookies.get("rp_google_signin_from")?.value || "/admin";
  const dest = from.startsWith("/") ? from : "/admin";
  const resp = NextResponse.redirect(new URL(dest, req.url));
  resp.cookies.delete("rp_google_signin_state");
  resp.cookies.delete("rp_google_signin_from");
  return resp;
}
