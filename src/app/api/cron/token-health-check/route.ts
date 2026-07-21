/**
 * GET /api/cron/token-health-check
 * ─────────────────────────────────
 * Cron hebdomadaire (dimanche 3h UTC via vercel.json) qui vérifie que
 * les 3 tokens critiques externes sont toujours vivants :
 *
 *   • Meta Instagram (Page Access Token via /me/accounts)
 *   • Meta WhatsApp Cloud (System User token, permanent)
 *   • Google Calendar (refresh_token → nouvel access_token)
 *
 * Pour chacun :
 *   - Test réel via l'API du fournisseur
 *   - Si expire_at connu, on regarde s'il approche des 7 j restants
 *   - Log un agent_event success=false si mort ou proche expiration
 *
 * Résultat : dès qu'un token approche l'expiration, tu vois dans le
 * digest hebdo + panneau de santé une alerte AVANT que ça casse en prod.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSharedConfig } from "@/lib/studio-settings";
import { logEvent } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  channel: string;
  ok: boolean;
  detail: string;
  expires_in_days?: number;
};

async function checkInstagramToken(shared: Record<string, string>): Promise<CheckResult> {
  const token = shared.meta_access_token;
  if (!token) return { channel: "instagram", ok: true, detail: "Non connecté (skip)" };
  try {
    // Test réel
    const igId = shared.instagram_business_id;
    if (igId) {
      const r = await fetch(
        `https://graph.facebook.com/v20.0/${igId}?fields=id,username&access_token=${token}`
      );
      if (!r.ok) return { channel: "instagram", ok: false, detail: `HTTP ${r.status}` };
    }
    // Debug pour l'expiration
    const dbg = await fetch(
      `https://graph.facebook.com/v20.0/debug_token?input_token=${token}&access_token=${token}`
    );
    const dbgJson = (await dbg.json().catch(() => ({}))) as {
      data?: { expires_at?: number; is_valid?: boolean };
    };
    const d = dbgJson.data ?? {};
    if (!d.is_valid) return { channel: "instagram", ok: false, detail: "Token invalidé côté Meta" };
    if (d.expires_at && d.expires_at > 0) {
      const daysLeft = Math.floor((d.expires_at * 1000 - Date.now()) / 86400000);
      if (daysLeft < 7) {
        return {
          channel: "instagram",
          ok: false,
          detail: `Token expire dans ${daysLeft} j — reconnecter Instagram`,
          expires_in_days: daysLeft,
        };
      }
      return { channel: "instagram", ok: true, detail: `${daysLeft} j restants`, expires_in_days: daysLeft };
    }
    return { channel: "instagram", ok: true, detail: "Token permanent (jamais d'expiration)" };
  } catch (e) {
    return { channel: "instagram", ok: false, detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkWhatsAppToken(shared: Record<string, string>): Promise<CheckResult> {
  const token = shared.whatsapp_access_token;
  const phoneId = shared.whatsapp_phone_number_id;
  if (!token || !phoneId) return { channel: "whatsapp", ok: true, detail: "Non configuré (skip)" };
  try {
    const r = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}?access_token=${token}`
    );
    if (!r.ok) return { channel: "whatsapp", ok: false, detail: `HTTP ${r.status} — token expiré ou révoqué` };
    // Debug expiration
    const dbg = await fetch(
      `https://graph.facebook.com/v20.0/debug_token?input_token=${token}&access_token=${token}`
    );
    const dbgJson = (await dbg.json().catch(() => ({}))) as {
      data?: { expires_at?: number; is_valid?: boolean; type?: string };
    };
    const d = dbgJson.data ?? {};
    if (!d.is_valid) return { channel: "whatsapp", ok: false, detail: "Token invalidé côté Meta" };
    // System User = permanent
    if (d.type === "SYSTEM_USER" && d.expires_at === 0) {
      return { channel: "whatsapp", ok: true, detail: "System User token permanent" };
    }
    if (d.expires_at && d.expires_at > 0) {
      const daysLeft = Math.floor((d.expires_at * 1000 - Date.now()) / 86400000);
      if (daysLeft < 7) {
        return { channel: "whatsapp", ok: false, detail: `Token expire dans ${daysLeft} j`, expires_in_days: daysLeft };
      }
      return { channel: "whatsapp", ok: true, detail: `${daysLeft} j restants`, expires_in_days: daysLeft };
    }
    return { channel: "whatsapp", ok: true, detail: "Token OK (pas d'expiration remontée)" };
  } catch (e) {
    return { channel: "whatsapp", ok: false, detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkGoogleRefresh(shared: Record<string, string>): Promise<CheckResult> {
  const refresh = shared.google_refresh_token;
  const clientId = shared.google_client_id;
  const clientSecret = shared.google_client_secret;
  if (!refresh) return { channel: "google", ok: true, detail: "Non connecté (skip)" };
  if (!clientId || !clientSecret)
    return { channel: "google", ok: false, detail: "GOOGLE_CLIENT_ID/SECRET manquants" };
  try {
    // Tente un rafraîchissement — si ça marche, refresh_token toujours valide.
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string; error_description?: string };
      return {
        channel: "google",
        ok: false,
        detail: `Refresh échoué : ${j.error ?? "?"} — ${j.error_description ?? ""}`.slice(0, 200),
      };
    }
    return {
      channel: "google",
      ok: true,
      detail: `refresh_token valide (${shared.google_account_email ?? "?"})`,
    };
  } catch (e) {
    return { channel: "google", ok: false, detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

export async function GET(req: NextRequest) {
  // Sécurité : vérifier le secret Vercel Cron
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const shared = await getSharedConfig().catch(() => ({} as Record<string, string>));

  const results = await Promise.all([
    checkInstagramToken(shared),
    checkWhatsAppToken(shared),
    checkGoogleRefresh(shared),
  ]);

  // Log un event par canal (success = ok)
  await Promise.all(
    results.map((r) => {
      const slug =
        r.channel === "instagram" ? "marketing" : r.channel === "whatsapp" ? "whatsapp" : "whatsapp";
      return logEvent(
        slug,
        `token_health_${r.channel}`,
        { detail: r.detail, expires_in_days: r.expires_in_days },
        r.ok
      ).catch(() => {});
    })
  );

  const failing = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: failing.length === 0,
    checked: results.length,
    failing: failing.length,
    results,
  });
}
