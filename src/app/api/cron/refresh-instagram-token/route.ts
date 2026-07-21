/**
 * GET /api/cron/refresh-instagram-token
 * ──────────────────────────────────────
 * Cron mensuel (le 1er du mois à 4h UTC via vercel.json).
 * Refresh proactif du meta_access_token Instagram :
 *   • Si le token expire dans < 30 jours → on le renouvelle
 *   • Sinon on ne fait rien (économise des appels API)
 *
 * Meta long-lived tokens durent 60 jours et peuvent être refresh via
 * fb_exchange_token. Sans ce cron, IG casserait tous les 2 mois.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSharedConfig, writeSharedKey } from "@/lib/studio-settings";
import { logEvent, updateAgentConfig } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const shared = await getSharedConfig().catch(() => ({} as Record<string, string>));
  const token = shared.meta_access_token;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!token) {
    return NextResponse.json({ ok: true, skipped: "no_token" });
  }
  if (!appId || !appSecret) {
    await logEvent("marketing", "ig_token_refresh_error", { reason: "no_app_env" }, false);
    return NextResponse.json({ ok: false, error: "META_APP_ID/SECRET manquants" }, { status: 500 });
  }

  // 1) Vérifie l'expiration actuelle
  try {
    const dbg = await fetch(
      `https://graph.facebook.com/v20.0/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`
    );
    const dbgJson = (await dbg.json().catch(() => ({}))) as {
      data?: { expires_at?: number; is_valid?: boolean; type?: string };
    };
    const d = dbgJson.data ?? {};

    if (!d.is_valid) {
      await logEvent("marketing", "ig_token_dead", { reason: "invalid" }, false);
      return NextResponse.json({ ok: false, error: "Token invalidé (reconnexion requise)" });
    }

    // Système User = permanent, pas de refresh nécessaire
    if (d.type === "SYSTEM_USER" || d.expires_at === 0) {
      return NextResponse.json({ ok: true, skipped: "permanent_token" });
    }

    if (d.expires_at && d.expires_at > 0) {
      const daysLeft = Math.floor((d.expires_at * 1000 - Date.now()) / 86400000);
      if (daysLeft > 30) {
        return NextResponse.json({
          ok: true,
          skipped: "still_valid",
          days_left: daysLeft,
        });
      }
    }
  } catch (e) {
    await logEvent(
      "marketing",
      "ig_token_refresh_error",
      { reason: "debug_failed", error: e instanceof Error ? e.message : "?" },
      false
    );
    // On continue et tente le refresh quand même
  }

  // 2) Refresh via fb_exchange_token
  try {
    const refreshUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
    refreshUrl.searchParams.set("client_id", appId);
    refreshUrl.searchParams.set("client_secret", appSecret);
    refreshUrl.searchParams.set("fb_exchange_token", token);

    const r = await fetch(refreshUrl.toString());
    const json = (await r.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!r.ok || !json.access_token) {
      const err = json.error?.message ?? `HTTP ${r.status}`;
      await logEvent("marketing", "ig_token_refresh_error", { reason: "refresh_call", error: err }, false);
      return NextResponse.json({ ok: false, error: err });
    }

    // 3) Persiste le nouveau token
    await writeSharedKey("meta_access_token", json.access_token);
    await updateAgentConfig("marketing", { meta_access_token: json.access_token }).catch(() => {});

    await logEvent(
      "marketing",
      "ig_token_refreshed",
      { new_expires_in_days: json.expires_in ? Math.floor(json.expires_in / 86400) : null },
      true
    );

    return NextResponse.json({
      ok: true,
      refreshed: true,
      new_expires_in_days: json.expires_in ? Math.floor(json.expires_in / 86400) : null,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : "?";
    await logEvent("marketing", "ig_token_refresh_error", { reason: "exception", error: err }, false);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
