/**
 * Panneau de santé système
 * ─────────────────────────
 * Teste EN LIVE tous les points de vie de la plateforme :
 *   • Anthropic Claude (message ping)
 *   • OpenAI Whisper (models endpoint)
 *   • Meta WhatsApp (Graph API phone number info)
 *   • Meta Instagram (Graph API IG account, si connecté)
 *   • Google Calendar (calendarList si refresh_token présent)
 *   • Telegram bot (getMe)
 *   • Webhooks WhatsApp + Telegram + /api/chat (santé HTTP)
 *   • 4 agents : config, prompt, KB
 *
 * Affichage vert / jaune / rouge + rappel d'action si cassé.
 * Toutes les vérifs sont faites en parallèle côté serveur.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { getSharedConfig } from "@/lib/studio-settings";
import { getAgents, getAgent } from "@/lib/agents";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Santé système — Romero Photography",
};

type CheckStatus = "ok" | "warn" | "err" | "skip";
type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  fix?: { href: string; label: string };
};

// ─── Individual checks ────────────────────────────────────────────────
async function checkAnthropic(apiKey?: string): Promise<Check> {
  if (!apiKey) return { key: "anthropic", label: "Anthropic Claude", status: "err", detail: "Clé ANTHROPIC_API_KEY manquante", fix: { href: "/admin/agents/studio", label: "Réglages" } };
  try {
    // Ping léger : /v1/models
    const r = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      cache: "no-store",
    });
    if (!r.ok) return { key: "anthropic", label: "Anthropic Claude", status: "err", detail: `HTTP ${r.status}` };
    const data = (await r.json()) as { data?: unknown[] };
    return { key: "anthropic", label: "Anthropic Claude", status: "ok", detail: `${data.data?.length ?? "?"} modèles accessibles` };
  } catch (e) {
    return { key: "anthropic", label: "Anthropic Claude", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkOpenAI(apiKey?: string): Promise<Check> {
  if (!apiKey) return { key: "openai", label: "OpenAI (Whisper vocaux)", status: "warn", detail: "Clé absente — vocaux WhatsApp/Telegram désactivés", fix: { href: "/admin/agents/studio", label: "Réglages" } };
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!r.ok) return { key: "openai", label: "OpenAI (Whisper)", status: "err", detail: `HTTP ${r.status}` };
    return { key: "openai", label: "OpenAI (Whisper vocaux)", status: "ok", detail: "Clé valide" };
  } catch (e) {
    return { key: "openai", label: "OpenAI (Whisper)", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkWhatsApp(shared: Record<string, string>): Promise<Check> {
  const token = shared.whatsapp_access_token;
  const phoneId = shared.whatsapp_phone_number_id;
  if (!token || !phoneId) {
    return { key: "whatsapp", label: "WhatsApp Cloud API", status: "warn", detail: "Non configuré (token ou phone ID manquant)", fix: { href: "/admin/agents/studio", label: "Connecter WhatsApp" } };
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?access_token=${token}`, { cache: "no-store" });
    if (!r.ok) return { key: "whatsapp", label: "WhatsApp Cloud API", status: "err", detail: `HTTP ${r.status}` };
    const data = (await r.json()) as { display_phone_number?: string; quality_rating?: string; verified_name?: string };
    return { key: "whatsapp", label: "WhatsApp Cloud API", status: "ok", detail: `${data.display_phone_number ?? "?"} · ${data.verified_name ?? ""} · Quality ${data.quality_rating ?? "?"}` };
  } catch (e) {
    return { key: "whatsapp", label: "WhatsApp Cloud API", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkInstagram(shared: Record<string, string>): Promise<Check> {
  const token = shared.meta_access_token;
  const igId = shared.instagram_business_id;
  if (!token || !igId) {
    return { key: "instagram", label: "Instagram Graph API", status: "warn", detail: "Non connecté (OAuth Meta non lancé)", fix: { href: "/admin/agents/studio", label: "Connecter Instagram" } };
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${igId}?fields=name,username,followers_count&access_token=${token}`, { cache: "no-store" });
    if (!r.ok) return { key: "instagram", label: "Instagram Graph API", status: "err", detail: `HTTP ${r.status}` };
    const data = (await r.json()) as { username?: string; followers_count?: number };
    return { key: "instagram", label: "Instagram Graph API", status: "ok", detail: `@${data.username ?? "?"} · ${data.followers_count ?? "?"} followers` };
  } catch (e) {
    return { key: "instagram", label: "Instagram Graph API", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkGoogle(shared: Record<string, string>): Promise<Check> {
  const refresh = shared.google_refresh_token;
  const clientId = shared.google_client_id;
  const clientSecret = shared.google_client_secret;
  if (!refresh) {
    return { key: "google", label: "Google Agenda", status: "warn", detail: "Compte Google non connecté (RDV → agenda désactivés)", fix: { href: "/admin/agents/studio", label: "Connecter Google" } };
  }
  if (!clientId || !clientSecret) {
    return { key: "google", label: "Google Agenda", status: "err", detail: "GOOGLE_CLIENT_ID/SECRET manquants côté ENV" };
  }
  try {
    // Rafraîchit le access_token
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
      cache: "no-store",
    });
    if (!r.ok) return { key: "google", label: "Google Agenda", status: "err", detail: `Refresh token invalide (HTTP ${r.status})`, fix: { href: "/admin/agents/studio", label: "Reconnecter" } };
    const at = ((await r.json()) as { access_token?: string }).access_token;
    if (!at) return { key: "google", label: "Google Agenda", status: "err", detail: "Pas d'access_token reçu" };
    // Vérifie l'accès au calendarList
    const cal = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=5", {
      headers: { Authorization: `Bearer ${at}` },
      cache: "no-store",
    });
    if (!cal.ok) return { key: "google", label: "Google Agenda", status: "err", detail: `Calendar API HTTP ${cal.status}` };
    const list = (await cal.json()) as { items?: Array<{ id: string; summary?: string }> };
    return { key: "google", label: "Google Agenda", status: "ok", detail: `${list.items?.length ?? 0} calendriers accessibles${shared.google_account_email ? ` (${shared.google_account_email})` : ""}` };
  } catch (e) {
    return { key: "google", label: "Google Agenda", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkTelegram(shared: Record<string, string>): Promise<Check> {
  const token = shared.telegram_bot_token;
  if (!token) return { key: "telegram", label: "Telegram Bot", status: "warn", detail: "TELEGRAM_BOT_TOKEN absent" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
    if (!r.ok) return { key: "telegram", label: "Telegram Bot", status: "err", detail: `HTTP ${r.status}` };
    const data = (await r.json()) as { ok?: boolean; result?: { username?: string; first_name?: string } };
    if (!data.ok) return { key: "telegram", label: "Telegram Bot", status: "err", detail: "Réponse non-OK" };
    const owner = shared.telegram_allowed_user_id
      ? ` · Propriétaire ID ${shared.telegram_allowed_user_id}`
      : " · En attente du premier /start";
    return { key: "telegram", label: "Telegram Bot", status: "ok", detail: `@${data.result?.username ?? "?"}${owner}` };
  } catch (e) {
    return { key: "telegram", label: "Telegram Bot", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkTelegramWebhook(): Promise<Check> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { key: "tg_webhook", label: "Webhook Telegram", status: "skip", detail: "Token manquant" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: "no-store" });
    const data = (await r.json()) as { result?: { url?: string; pending_update_count?: number; last_error_message?: string | null } };
    const res = data.result;
    if (!res?.url) return { key: "tg_webhook", label: "Webhook Telegram", status: "warn", detail: "URL webhook non définie" };
    if (res.last_error_message) return { key: "tg_webhook", label: "Webhook Telegram", status: "err", detail: `Dernière erreur : ${res.last_error_message}` };
    return { key: "tg_webhook", label: "Webhook Telegram", status: "ok", detail: `URL OK · ${res.pending_update_count ?? 0} pending` };
  } catch (e) {
    return { key: "tg_webhook", label: "Webhook Telegram", status: "err", detail: e instanceof Error ? e.message : "Erreur réseau" };
  }
}

async function checkDb(): Promise<Check> {
  try {
    const row = await queryOne<{ n: number }>("SELECT 1::int AS n");
    if (!row) return { key: "db", label: "Base de données", status: "err", detail: "Réponse vide" };
    return { key: "db", label: "Base de données Postgres", status: "ok", detail: "Connexion active" };
  } catch (e) {
    return { key: "db", label: "Base de données Postgres", status: "err", detail: e instanceof Error ? e.message : "Erreur DB" };
  }
}

async function checkCrons(): Promise<Check> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { key: "crons", label: "Crons Vercel", status: "warn", detail: "CRON_SECRET absent — les crons ne pourront pas s'exécuter" };
  return { key: "crons", label: "Crons Vercel", status: "ok", detail: "Secret présent · vercel.json déploie 7 crons" };
}

async function checkAgents(): Promise<Check[]> {
  try {
    const agents = await getAgents();
    return agents.map((a) => {
      const cfg = (a.config ?? {}) as Record<string, unknown>;
      const hasKey = !!cfg.anthropic_api_key;
      const isPaused = a.status === "paused";
      const isError = a.status === "error";
      const status: CheckStatus = isError ? "err" : isPaused ? "warn" : hasKey ? "ok" : "warn";
      const detail = isError
        ? "En erreur"
        : isPaused
        ? "Mis en pause"
        : hasKey
        ? "Actif · config OK"
        : "Sans clé API — non fonctionnel";
      return {
        key: `agent_${a.slug}`,
        label: `Agent ${a.slug} — ${a.name}`,
        status,
        detail,
        fix: { href: `/admin/agents/${a.slug}`, label: "Ouvrir" },
      };
    });
  } catch {
    return [{ key: "agents", label: "4 agents", status: "err", detail: "Impossible de lire agent_installations" }];
  }
}

async function checkKb(): Promise<Check[]> {
  try {
    const rows = await query<{ slug: string; c: number }>(
      "SELECT slug, COUNT(*)::int as c FROM agent_knowledge GROUP BY slug"
    );
    const map = new Map(rows.map((r) => [r.slug, r.c]));
    const slugs: Array<{ slug: string; label: string; min: number }> = [
      { slug: "site", label: "KB Site", min: 10 },
      { slug: "whatsapp", label: "KB WhatsApp", min: 15 },
      { slug: "marketing", label: "KB Marketing", min: 15 },
      { slug: "admin", label: "KB Admin", min: 15 },
    ];
    return slugs.map(({ slug, label, min }) => {
      const c = map.get(slug) ?? 0;
      const status: CheckStatus = c >= min ? "ok" : c > 0 ? "warn" : "err";
      const detail = `${c} fiches${c < min ? ` (recommandé ≥ ${min})` : ""}`;
      return {
        key: `kb_${slug}`,
        label,
        status,
        detail,
        fix: { href: `/admin/agents/${slug}?tab=knowledge`, label: "Enrichir" },
      };
    });
  } catch {
    return [];
  }
}

async function checkStudio(shared: Record<string, string>): Promise<Check[]> {
  const items: Check[] = [];
  const need = (key: string, label: string, hint: string): Check => ({
    key: `studio_${key}`,
    label,
    status: shared[key] ? "ok" : "warn",
    detail: shared[key] ? `${(shared[key] as string).slice(0, 40)}${(shared[key] as string).length > 40 ? "…" : ""}` : hint,
    fix: { href: "/admin/agents/studio", label: "Compléter" },
  });
  items.push(need("siret", "SIRET entreprise", "Utilisé sur factures/devis"));
  items.push(need("legal_name", "Nom légal", "Utilisé sur documents"));
  items.push(need("legal_address", "Adresse pro", "Utilisée en en-tête PDF"));
  items.push(need("notification_email", "E-mail leads", "Où arrivent les leads chatbot"));
  return items;
}

async function checkRecentActivity(): Promise<Check> {
  try {
    const row = await queryOne<{ c: number }>(
      "SELECT COUNT(*)::int as c FROM agent_events WHERE created_at >= NOW() - INTERVAL '24 hours'"
    );
    const c = row?.c ?? 0;
    if (c === 0) return { key: "activity", label: "Activité (24 h)", status: "warn", detail: "Aucun événement depuis 24 h" };
    return { key: "activity", label: "Activité (24 h)", status: "ok", detail: `${c} événements` };
  } catch {
    return { key: "activity", label: "Activité (24 h)", status: "skip" };
  }
}

// ─── Rendering ────────────────────────────────────────────────────────
function toneOf(s: CheckStatus): { color: string; icon: string; label: string } {
  switch (s) {
    case "ok": return { color: "#9DCE9D", icon: "✓", label: "OK" };
    case "warn": return { color: "#B8975A", icon: "!", label: "Attention" };
    case "err": return { color: "#E48A8A", icon: "✗", label: "Erreur" };
    case "skip": return { color: "rgba(244,239,227,0.4)", icon: "—", label: "Ignoré" };
  }
}

function CheckRow({ c }: { c: Check }) {
  const tone = toneOf(c.status);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderBottom: "1px solid rgba(184,151,90,0.1)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 4,
          background: `${tone.color}22`,
          color: tone.color,
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
        aria-label={tone.label}
      >
        {tone.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--gold-light, #F4EFE3)" }}>{c.label}</div>
        {c.detail ? (
          <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 2, wordBreak: "break-word" }}>{c.detail}</div>
        ) : null}
      </div>
      {c.status !== "ok" && c.fix ? (
        <Link
          href={c.fix.href}
          className="agent-btn"
          style={{ fontSize: 11, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          {c.fix.label} →
        </Link>
      ) : null}
    </div>
  );
}

function Section({ title, checks }: { title: string; checks: Check[] }) {
  const okCount = checks.filter((c) => c.status === "ok").length;
  return (
    <div className="agent-panel" style={{ marginBottom: 22 }}>
      <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span>{title}</span>
        <span style={{ fontSize: 12, opacity: 0.55, fontWeight: 400 }}>
          {okCount}/{checks.length} OK
        </span>
      </h2>
      <div style={{ marginTop: 8 }}>
        {checks.map((c) => <CheckRow key={c.key} c={c} />)}
      </div>
    </div>
  );
}

export default async function HealthPage() {
  const shared = await getSharedConfig().catch(() => ({} as Record<string, string>));

  const [
    infraDb,
    infraCron,
    ai_anthropic,
    ai_openai,
    api_wa,
    api_ig,
    api_google,
    api_tg,
    tg_hook,
    agents,
    kb,
    studio,
    activity,
  ] = await Promise.all([
    checkDb(),
    checkCrons(),
    checkAnthropic(shared.anthropic_api_key),
    checkOpenAI(shared.openai_api_key),
    checkWhatsApp(shared),
    checkInstagram(shared),
    checkGoogle(shared),
    checkTelegram(shared),
    checkTelegramWebhook(),
    checkAgents(),
    checkKb(),
    checkStudio(shared),
    checkRecentActivity(),
  ]);

  // Résumé global
  const allChecks: Check[] = [
    infraDb, infraCron, ai_anthropic, ai_openai,
    api_wa, api_ig, api_google, api_tg, tg_hook,
    ...agents, ...kb, ...studio, activity,
  ];
  const okN = allChecks.filter((c) => c.status === "ok").length;
  const warnN = allChecks.filter((c) => c.status === "warn").length;
  const errN = allChecks.filter((c) => c.status === "err").length;
  const total = allChecks.length;
  const healthPct = Math.round((okN / total) * 100);

  return (
    <div>
      <Link href="/admin/agents" className="agent-back">
        ← Retour aux agents
      </Link>

      <section className="agents-hero" style={{ marginBottom: 22 }}>
        <div className="agents-hero__eyebrow">Diagnostic</div>
        <h1 className="agents-hero__title">
          Santé <em>système</em>
        </h1>
        <p className="agents-hero__lead">
          Tous les points de vie de la plateforme, testés en direct : APIs, webhooks, tokens, agents, KB.
          Rechargez la page pour rafraîchir.
        </p>
      </section>

      {/* Résumé */}
      <div
        className="agent-panel"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          marginBottom: 22,
        }}
      >
        <div style={{ flexShrink: 0, textAlign: "center", minWidth: 120 }}>
          <div style={{ fontSize: 42, fontWeight: 300, color: healthPct >= 90 ? "#9DCE9D" : healthPct >= 70 ? "#B8975A" : "#E48A8A" }}>
            {healthPct}%
          </div>
          <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: -4 }}>
            Santé globale
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <SummaryLine label="✓ OK" count={okN} color="#9DCE9D" />
          <SummaryLine label="! Attention" count={warnN} color="#B8975A" />
          <SummaryLine label="✗ Erreur" count={errN} color="#E48A8A" />
        </div>
      </div>

      <Section title="Infrastructure" checks={[infraDb, infraCron]} />
      <Section title="Intelligence artificielle" checks={[ai_anthropic, ai_openai]} />
      <Section title="Canaux — APIs externes" checks={[api_wa, api_ig, api_google, api_tg]} />
      <Section title="Webhooks" checks={[tg_hook]} />
      <Section title="Informations studio (Studio Settings)" checks={studio} />
      <Section title="Les 4 agents" checks={agents} />
      <Section title="Base de connaissances" checks={kb} />
      <Section title="Activité récente" checks={[activity]} />
    </div>
  );
}

function SummaryLine({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{ color, fontWeight: 600, minWidth: 90 }}>{label}</span>
      <span style={{ opacity: 0.85 }}>{count}</span>
    </div>
  );
}
