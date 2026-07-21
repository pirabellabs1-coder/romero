/**
 * GET /api/auth/google/signin/callback
 * ────────────────────────────────────
 * Reçoit le code Google SSO, l'échange contre un access_token, récupère
 * l'email/profil du user, puis pose la session admin via loginWithGoogle.
 *
 * Sur la PREMIÈRE connexion, déclenche plein d'auto-actions utiles :
 *   • Sauve name + picture + locale dans studio_settings (affichés dans
 *     la sidebar admin ensuite).
 *   • Sauve notification_email si pas encore défini.
 *   • Enregistre first_signin_at (timestamp ISO).
 *   • Redirige vers /admin/onboarding au lieu de /admin (l'user va
 *     directement au wizard de configuration).
 *
 * Sur les connexions suivantes : session posée + redirect vers `from`.
 */
import { NextRequest, NextResponse } from "next/server";
import { loginWithGoogle } from "@/lib/auth";
import { getSharedConfig, writeSharedKey } from "@/lib/studio-settings";
import { logEvent } from "@/lib/agents";

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

type GoogleProfile = {
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  email_verified?: boolean;
};

async function fetchProfile(accessToken: string): Promise<GoogleProfile | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as GoogleProfile;
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

  const auth = await loginWithGoogle(profile.email);
  if (!auth) {
    return fail(
      req,
      `L'adresse ${profile.email} n'est pas autorisée à accéder à l'admin.`
    );
  }

  // ─── Auto-actions (à chaque signin, mais idempotentes) ────────────
  try {
    const shared = await getSharedConfig();

    // Toujours sauver le profil Google pour affichage (avatar + nom
    // dans la sidebar). Une nouvelle photo/nom écrase l'ancien.
    if (profile.name) await writeSharedKey("admin_name", profile.name);
    if (profile.picture) await writeSharedKey("admin_picture", profile.picture);
    if (profile.email) await writeSharedKey("admin_email", profile.email);
    if (profile.locale) await writeSharedKey("admin_locale", profile.locale);

    // notification_email = email admin par défaut si pas encore défini.
    if (!shared.notification_email && profile.email) {
      await writeSharedKey("notification_email", profile.email);
    }

    // legal_name suggestion — uniquement si vraiment rien n'est déjà là
    // (l'user pourra override via SIRET auto-lookup, mais ça donne un
    // fallback humain immédiat).
    if (!shared.legal_name && profile.name) {
      await writeSharedKey("legal_name", profile.name);
    }
  } catch {
    // Non-bloquant — l'important est d'avoir la session.
  }

  // ─── Actions PREMIÈRE connexion seulement ─────────────────────────
  let firstTimeRedirect = false;
  if (auth.isFirstSignin) {
    try {
      await writeSharedKey("first_signin_at", new Date().toISOString());
      await logEvent(
        "site",
        "admin_first_signin",
        { email: profile.email, name: profile.name ?? null },
        true
      );
      firstTimeRedirect = true;
    } catch {
      // Non-bloquant.
    }
  }

  // ─── Redirect ─────────────────────────────────────────────────────
  // Première connexion → onboarding (sauf si l'user avait explicitement
  // demandé une page précise). Sinon → `from`.
  const from = req.cookies.get("rp_google_signin_from")?.value || "/admin";
  const fromValid = from.startsWith("/") ? from : "/admin";
  const dest = firstTimeRedirect ? "/admin/onboarding" : fromValid;

  const resp = NextResponse.redirect(new URL(dest, req.url));
  resp.cookies.delete("rp_google_signin_state");
  resp.cookies.delete("rp_google_signin_from");

  // Pose aussi le cookie « unlock » : un user validé par SSO n'a pas
  // besoin de re-visiter le chemin magique pour accéder à /admin/*.
  const unlockKey = process.env.ADMIN_UNLOCK_KEY;
  if (unlockKey && unlockKey.length >= 8) {
    resp.cookies.set("rp_admin_unlock", unlockKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    });
  }
  return resp;
}
