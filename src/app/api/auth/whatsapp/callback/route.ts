/**
 * GET /api/auth/whatsapp/callback
 * ───────────────────────────────
 * Reçoit le code Meta OAuth, échange contre un token long-lived,
 * résout la 1ère WABA + le 1er phone_number_id trouvé, et persiste
 * tout dans studio_settings pour que tous les agents en héritent.
 *
 * Champs stockés :
 *   whatsapp_access_token       (long-lived, ~60j — user access token)
 *   whatsapp_business_id        (WABA ID)
 *   whatsapp_phone_number_id    (ID technique du numéro)
 *   whatsapp_display_number     (numéro humain, ex : +33 6 12 34 56 78)
 *   whatsapp_business_name      (nom affiché de l'entreprise)
 *
 * Après le callback, l'user doit encore configurer côté Meta app
 * dashboard :
 *   1. Ajouter le produit « WhatsApp »
 *   2. Coller https://romerophotography.fr/api/whatsapp/webhook comme
 *      Callback URL + WHATSAPP_VERIFY_TOKEN comme Verify Token
 *   3. Souscrire au champ "messages"
 *
 * On lui affiche ces instructions dans la carte Studio Settings après
 * connexion.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logEvent, updateAgentConfig } from "@/lib/agents";
import { writeSharedKey } from "@/lib/studio-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flashRedirect(req: NextRequest, ok: boolean, msg: string): NextResponse {
  const url = new URL("/admin/agents/studio", req.url);
  url.searchParams.set(ok ? "ok" : "err", encodeURIComponent(msg));
  const r = NextResponse.redirect(url);
  r.cookies.delete("rp_meta_wa_state");
  return r;
}

async function exchangeShortToken(params: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const u = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  u.searchParams.set("client_id", params.appId);
  u.searchParams.set("client_secret", params.appSecret);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("code", params.code);
  const res = await fetch(u.toString());
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, token: json.access_token };
}

async function upgradeToLongLived(params: {
  shortToken: string;
  appId: string;
  appSecret: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const u = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", params.appId);
  u.searchParams.set("client_secret", params.appSecret);
  u.searchParams.set("fb_exchange_token", params.shortToken);
  const res = await fetch(u.toString());
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, token: json.access_token };
}

type Business = { id: string; name?: string };
type WABA = { id: string; name?: string; verified_name?: string };
type PhoneNumber = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

async function graphGet<T>(
  path: string,
  token: string
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
  } & Record<string, unknown>;
  if (!res.ok) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, data: (json.data ?? (json as unknown)) as T };
}

async function resolveWhatsApp(token: string): Promise<
  | {
      ok: true;
      business: Business;
      waba: WABA;
      phone: PhoneNumber;
    }
  | { ok: false; error: string }
> {
  const biz = await graphGet<Business[]>("me/businesses?fields=id,name", token);
  if (!biz.ok) return { ok: false, error: `Meta /me/businesses : ${biz.error}` };
  if (!biz.data || biz.data.length === 0) {
    return {
      ok: false,
      error:
        "Aucun Business Portfolio Meta trouvé. Va sur business.facebook.com et crée-en un avant de connecter WhatsApp.",
    };
  }

  // On tente chaque Business jusqu'à trouver une WABA avec un phone.
  for (const b of biz.data) {
    const wabas = await graphGet<WABA[]>(
      `${b.id}/owned_whatsapp_business_accounts?fields=id,name,verified_name`,
      token
    );
    if (!wabas.ok || !wabas.data || wabas.data.length === 0) continue;

    for (const w of wabas.data) {
      const phones = await graphGet<PhoneNumber[]>(
        `${w.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
        token
      );
      if (!phones.ok || !phones.data || phones.data.length === 0) continue;
      return { ok: true, business: b, waba: w, phone: phones.data[0] };
    }
  }

  return {
    ok: false,
    error:
      "Aucun compte WhatsApp Business (WABA) avec un numéro de téléphone trouvé. Va dans Meta Business → WhatsApp → ajoute un compte + valide un numéro, puis reviens.",
  };
}

async function subscribeApp(
  wabaId: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  // POST /{waba-id}/subscribed_apps — abonne notre app aux webhooks
  // messages de cette WABA. Nécessite whatsapp_business_management.
  const url = new URL(`https://graph.facebook.com/v20.0/${wabaId}/subscribed_apps`);
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url.toString(), { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string };
    };
    if (!res.ok || !json.success)
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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

  if (errParam)
    return flashRedirect(req, false, `Autorisation refusée : ${errDesc || errParam}`);
  if (!code) return flashRedirect(req, false, "Code Meta manquant.");
  const cookieState = req.cookies.get("rp_meta_wa_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return flashRedirect(req, false, "State OAuth invalide (protection CSRF).");
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return flashRedirect(req, false, "META_APP_ID / META_APP_SECRET manquants côté ENV.");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/whatsapp/callback`;

  const shortRes = await exchangeShortToken({ code, appId, appSecret, redirectUri });
  if (!shortRes.ok) {
    await logEvent("whatsapp", "meta_wa_oauth_error", { step: "short", error: shortRes.error }, false);
    return flashRedirect(req, false, `Échange OAuth Meta échoué : ${shortRes.error}`);
  }

  const longRes = await upgradeToLongLived({
    shortToken: shortRes.token,
    appId,
    appSecret,
  });
  if (!longRes.ok) {
    await logEvent("whatsapp", "meta_wa_oauth_error", { step: "long", error: longRes.error }, false);
    return flashRedirect(req, false, `Conversion long-lived échouée : ${longRes.error}`);
  }

  const resolved = await resolveWhatsApp(longRes.token);
  if (!resolved.ok) {
    await logEvent("whatsapp", "meta_wa_oauth_error", { step: "resolve", error: resolved.error }, false);
    return flashRedirect(req, false, resolved.error);
  }

  // Abonne notre app aux webhooks de cette WABA (best effort, on continue même si échec).
  const sub = await subscribeApp(resolved.waba.id, longRes.token);
  if (!sub.ok) {
    await logEvent(
      "whatsapp",
      "meta_wa_subscribe_warn",
      { error: sub.error, waba: resolved.waba.id },
      false
    );
  }

  // Écriture dans studio_settings pour tous les agents.
  await writeSharedKey("whatsapp_access_token", longRes.token);
  await writeSharedKey("whatsapp_business_id", resolved.waba.id);
  await writeSharedKey("whatsapp_phone_number_id", resolved.phone.id);
  if (resolved.phone.display_phone_number)
    await writeSharedKey("whatsapp_display_number", resolved.phone.display_phone_number);
  const bizName = resolved.waba.verified_name || resolved.waba.name || resolved.business.name;
  if (bizName) await writeSharedKey("whatsapp_business_name", bizName);
  await writeSharedKey("whatsapp_connected_at", new Date().toISOString());

  // Compat rétro : copie côté agent whatsapp.
  await updateAgentConfig("whatsapp", {
    whatsapp_access_token: longRes.token,
    whatsapp_business_id: resolved.waba.id,
    whatsapp_phone_number_id: resolved.phone.id,
    whatsapp_display_number: resolved.phone.display_phone_number ?? "",
  });

  await logEvent("whatsapp", "whatsapp_connected", {
    business: resolved.business.name,
    phone: resolved.phone.display_phone_number,
    subscribe_ok: sub.ok,
  });

  const msg = sub.ok
    ? `WhatsApp connecté (${resolved.phone.display_phone_number ?? "numéro business"}). Il te reste à configurer le webhook côté Meta app dashboard (voir la carte WhatsApp).`
    : `WhatsApp connecté partiellement. L'abonnement au webhook a échoué (${sub.error}). Configure-le manuellement dans Meta app dashboard.`;

  return flashRedirect(req, true, msg);
}
