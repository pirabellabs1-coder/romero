/**
 * GET /api/auth/instagram/callback
 * ────────────────────────────────
 * Reçoit le code Meta OAuth, échange contre short-lived → long-lived
 * user access token, résout la Page FB → Instagram Business Account,
 * puis persiste dans agent_installations.config (slug marketing) :
 *   • meta_access_token      (Page Access Token long-lived)
 *   • instagram_business_id  (compte IG lié)
 *   • meta_page_id           (page FB liée — utile pour l'insight)
 *   • meta_page_name         (libellé humain affiché dans l'UI)
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
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const u = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  u.searchParams.set("client_id", params.appId);
  u.searchParams.set("client_secret", params.appSecret);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("code", params.code);
  const res = await fetch(u.toString(), { method: "GET" });
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
}): Promise<{ ok: true; token: string; expiresIn: number } | { ok: false; error: string }> {
  const u = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", params.appId);
  u.searchParams.set("client_secret", params.appSecret);
  u.searchParams.set("fb_exchange_token", params.shortToken);
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

type PageEntry = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

async function resolveInstagramPage(
  userToken: string
): Promise<
  | { ok: true; page: PageEntry & { instagram_business_account: { id: string } } }
  | { ok: false; error: string }
> {
  const u = new URL("https://graph.facebook.com/v20.0/me/accounts");
  u.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  u.searchParams.set("access_token", userToken);
  const res = await fetch(u.toString());
  const json = (await res.json().catch(() => ({}))) as {
    data?: PageEntry[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  const pageWithIg = json.data?.find((p) => p.instagram_business_account?.id);
  if (!pageWithIg) {
    return {
      ok: false,
      error:
        "Aucune Page Facebook liée à un compte Instagram Business n'a été trouvée. Assure-toi que ton compte IG est en mode Business et lié à une Page FB.",
    };
  }
  return {
    ok: true,
    page: pageWithIg as PageEntry & { instagram_business_account: { id: string } },
  };
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
    return flashRedirect(req, false, "Code Meta manquant.");
  }
  const cookieState = req.cookies.get("rp_meta_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return flashRedirect(req, false, "State OAuth invalide (protection CSRF).");
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return flashRedirect(req, false, "META_APP_ID / META_APP_SECRET manquants côté ENV.");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/instagram/callback`;

  const shortRes = await exchangeCodeForShortToken({ code, appId, appSecret, redirectUri });
  if (!shortRes.ok) {
    await logEvent("marketing", "meta_oauth_error", { step: "short", error: shortRes.error }, false);
    return flashRedirect(req, false, `Échange OAuth Meta échoué : ${shortRes.error}`);
  }

  const longRes = await upgradeToLongLived({
    shortToken: shortRes.token,
    appId,
    appSecret,
  });
  if (!longRes.ok) {
    await logEvent("marketing", "meta_oauth_error", { step: "long", error: longRes.error }, false);
    return flashRedirect(req, false, `Conversion long-lived échouée : ${longRes.error}`);
  }

  const pageRes = await resolveInstagramPage(longRes.token);
  if (!pageRes.ok) {
    await logEvent("marketing", "meta_oauth_error", { step: "page", error: pageRes.error }, false);
    return flashRedirect(req, false, pageRes.error);
  }

  // Écriture dans studio_settings pour que tous les agents héritent.
  await writeSharedKey("meta_access_token", pageRes.page.access_token);
  await writeSharedKey("instagram_business_id", pageRes.page.instagram_business_account.id);
  await writeSharedKey("meta_page_id", pageRes.page.id);
  await writeSharedKey("meta_page_name", pageRes.page.name);
  // Compat rétro : copie côté marketing pour du code qui lirait rawConfig.
  await updateAgentConfig("marketing", {
    meta_access_token: pageRes.page.access_token,
    instagram_business_id: pageRes.page.instagram_business_account.id,
    meta_page_id: pageRes.page.id,
    meta_page_name: pageRes.page.name,
  });
  await logEvent("marketing", "instagram_connected", {
    page: pageRes.page.name,
    ig_id: pageRes.page.instagram_business_account.id,
  });

  return flashRedirect(
    req,
    true,
    `Instagram connecté (Page « ${pageRes.page.name} »).`
  );
}
