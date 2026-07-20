/**
 * GET /api/auth/google/callback
 * Reçoit le code d'autorisation Google, l'échange contre des tokens,
 * et persiste le refresh_token dans agent_installations.config.
 *
 * Sécurité :
 *   - Validation du `state` via cookie httpOnly (CSRF)
 *   - Authentification admin requise
 *   - Le refresh_token n'apparaît jamais dans une URL ou log public
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAgent, updateAgentConfig, logEvent } from "@/lib/agents";
import { exchangeCodeForTokens, getUserEmail } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithFlash(
  req: NextRequest,
  ok: boolean,
  msg: string
): NextResponse {
  const url = new URL("/admin/agents/whatsapp?tab=config", req.url);
  url.searchParams.set(ok ? "ok" : "err", encodeURIComponent(msg));
  const resp = NextResponse.redirect(url);
  resp.cookies.delete("rp_google_oauth_state");
  return resp;
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const errorParam = params.get("error");

  // Utilisateur a refusé l'accès
  if (errorParam) {
    return redirectWithFlash(req, false, `Autorisation refusée : ${errorParam}`);
  }
  if (!code) {
    return redirectWithFlash(req, false, "Code d'autorisation manquant.");
  }

  // Validation CSRF
  const cookieState = req.cookies.get("rp_google_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return redirectWithFlash(req, false, "State OAuth invalide (protection CSRF).");
  }

  // ENV en priorité (config plateforme partagée), fallback config agent.
  const inst = await getAgent("whatsapp");
  const cfg = inst?.config as
    | { google_client_id?: string; google_client_secret?: string }
    | undefined;
  const clientId = process.env.GOOGLE_CLIENT_ID || cfg?.google_client_id;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || cfg?.google_client_secret;
  if (!clientId || !clientSecret) {
    return redirectWithFlash(
      req,
      false,
      "Configuration Google Cloud manquante côté plateforme (contactez le studio)."
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const result = await exchangeCodeForTokens({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });
  if (!result.ok) {
    await logEvent("whatsapp", "google_oauth_error", { error: result.error }, false);
    return redirectWithFlash(req, false, `Échange OAuth échoué : ${result.error}`);
  }

  const email = await getUserEmail(result.tokens.access_token);
  await updateAgentConfig("whatsapp", {
    google_refresh_token: result.tokens.refresh_token!,
    ...(email ? { google_account_email: email } : {}),
  });
  await logEvent("whatsapp", "google_connected", { email });

  return redirectWithFlash(
    req,
    true,
    email
      ? `Google Calendar connecté (${email}).`
      : "Google Calendar connecté."
  );
}
