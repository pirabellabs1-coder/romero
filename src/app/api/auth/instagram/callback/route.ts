/**
 * GET /api/auth/instagram/callback
 * ────────────────────────────────
 * Reçoit le code Instagram OAuth, échange contre :
 *   1. short-lived user access token (+ IG business account user_id)
 *   2. long-lived user access token (60 jours)
 *
 * Persistance :
 *   • studio_settings (partagé, source de vérité) :
 *     - meta_access_token       (alias legacy — même valeur qu'IG token)
 *     - instagram_access_token
 *     - instagram_business_id
 *     - instagram_username      (libellé humain)
 *   • agent_installations.config (slug marketing) : copie de compat
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateAgentConfig, logEvent } from "@/lib/agents";
import { writeSharedKey } from "@/lib/studio-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flashRedirect(req: NextRequest, ok: boolean, msg: string): NextResponse {
  const url = new URL("/admin/agents/marketing?tab=config", req.url);
  url.searchParams.set(ok ? "ok" : "err", encodeURIComponent(msg));
  const r = NextResponse.redirect(url);
  r.cookies.delete("rp_meta_oauth_state");
  return r;
}

async function exchangeCodeForShortToken(params: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
}): Promise<
  | { ok: true; token: string; userId: string }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams();
  body.set("client_id", params.appId);
  body.set("client_secret", params.appSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", params.redirectUri);
  body.set("code", params.code);
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    user_id?: number | string;
    error_type?: string;
    error_message?: string;
  };
  if (!res.ok || !json.access_token || !json.user_id) {
    return {
      ok: false,
      error: json.error_message || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    token: json.access_token,
    userId: String(json.user_id),
  };
}

async function upgradeToLongLived(params: {
  shortToken: string;
  appSecret: string;
}): Promise<
  | { ok: true; token: string; expiresIn: number }
  | { ok: false; error: string }
> {
  const u = new URL("https://graph.instagram.com/access_token");
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", params.appSecret);
  u.searchParams.set("access_token", params.shortToken);
  const res = await fetch(u.toString());
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, token: json.access_token, expiresIn: json.expires_in ?? 0 };
}

async function resolveUsername(
  igToken: string
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const u = new URL("https://graph.instagram.com/v20.0/me");
  u.searchParams.set("fields", "id,username");
  u.searchParams.set("access_token", igToken);
  const res = await fetch(u.toString());
  const json = (await res.json().catch(() => ({}))) as {
    username?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.username) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, username: json.username };
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
  const errParam = params.get("error");
  const errDesc = params.get("error_description");

  if (errParam) {
    return flashRedirect(req, false, `Autorisation refusée : ${errDesc || errParam}`);
  }
  if (!code) {
    return flashRedirect(req, false, "Code Instagram manquant.");
  }
  const cookieState = req.cookies.get("rp_meta_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return flashRedirect(req, false, "State OAuth invalide (protection CSRF).");
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    return flashRedirect(
      req,
      false,
      "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET manquants côté ENV."
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/instagram/callback`;

  const shortRes = await exchangeCodeForShortToken({
    code,
    appId,
    appSecret,
    redirectUri,
  });
  if (!shortRes.ok) {
    await logEvent(
      "marketing",
      "meta_oauth_error",
      { step: "short", error: shortRes.error },
      false
    );
    return flashRedirect(req, false, `Échange OAuth Instagram échoué : ${shortRes.error}`);
  }

  const longRes = await upgradeToLongLived({
    shortToken: shortRes.token,
    appSecret,
  });
  if (!longRes.ok) {
    await logEvent(
      "marketing",
      "meta_oauth_error",
      { step: "long", error: longRes.error },
      false
    );
    return flashRedirect(req, false, `Conversion long-lived échouée : ${longRes.error}`);
  }

  const nameRes = await resolveUsername(longRes.token);
  const username = nameRes.ok ? nameRes.username : "";

  // Écriture dans studio_settings pour que tous les agents héritent.
  await writeSharedKey("meta_access_token", longRes.token); // alias legacy
  await writeSharedKey("instagram_access_token", longRes.token);
  await writeSharedKey("instagram_business_id", shortRes.userId);
  if (username) await writeSharedKey("instagram_username", username);

  // Compat rétro : copie côté marketing.
  await updateAgentConfig("marketing", {
    meta_access_token: longRes.token,
    instagram_access_token: longRes.token,
    instagram_business_id: shortRes.userId,
    ...(username ? { instagram_username: username } : {}),
  });
  await logEvent("marketing", "instagram_connected", {
    username,
    ig_id: shortRes.userId,
  });

  return flashRedirect(
    req,
    true,
    username
      ? `Instagram connecté (@${username}).`
      : `Instagram connecté (ID ${shortRes.userId}).`
  );
}
