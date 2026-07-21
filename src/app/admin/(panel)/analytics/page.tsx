/**
 * Dashboard analytics unifié
 * ───────────────────────────
 * Vue cross-agent de l'entonnoir complet Mickael :
 *   Contact form + Chatbot  →  Conversations WA/TG/IG  →  Clients CRM
 *
 * Time series 30 jours + top-line KPIs + best-performing IG posts.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Analytics — Romero Photography",
};

async function loadKpis() {
  const [messages30, chatbotLeads30, waSessions30, tgSessions30, igSessions30, contacts, contactsThisMonth, invoicesPaid30, approvalsPending] =
    await Promise.all([
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM messages WHERE created_at >= NOW() - INTERVAL '30 days'`
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM chat_conversations WHERE created_at >= NOW() - INTERVAL '30 days'`
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM assistant_sessions WHERE platform='whatsapp' AND updated_at >= NOW() - INTERVAL '30 days'`
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM assistant_sessions WHERE platform='telegram' AND updated_at >= NOW() - INTERVAL '30 days'`
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM assistant_sessions WHERE platform='instagram' AND updated_at >= NOW() - INTERVAL '30 days'`
      ),
      queryOne<{ c: number }>(`SELECT COUNT(*)::int as c FROM admin_contacts`),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM admin_contacts WHERE created_at >= date_trunc('month', NOW())`
      ),
      queryOne<{ c: number }>(
        `SELECT COALESCE(SUM(total_billed_cents),0)::bigint as c
         FROM admin_contacts WHERE last_document_at >= NOW() - INTERVAL '30 days'`
      ).catch(() => null),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM pending_approvals WHERE status='pending'`
      ).catch(() => null),
    ]);
  return {
    messages30: messages30?.c ?? 0,
    chatbotLeads30: chatbotLeads30?.c ?? 0,
    waSessions30: waSessions30?.c ?? 0,
    tgSessions30: tgSessions30?.c ?? 0,
    igSessions30: igSessions30?.c ?? 0,
    contacts: contacts?.c ?? 0,
    contactsThisMonth: contactsThisMonth?.c ?? 0,
    revenueLast30Cents: Number(invoicesPaid30?.c ?? 0),
    approvalsPending: approvalsPending?.c ?? 0,
  };
}

async function loadTimeline30(): Promise<Array<{ day: string; contact: number; chatbot: number; wa: number; tg: number; ig: number }>> {
  const rows = await query<{
    day: string;
    contact: number;
    chatbot: number;
    wa: number;
    tg: number;
    ig: number;
  }>(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - INTERVAL '29 days')::date,
         CURRENT_DATE::date,
         '1 day'::interval
       )::date AS day
     )
     SELECT
       to_char(days.day, 'YYYY-MM-DD') AS day,
       COALESCE((SELECT COUNT(*) FROM messages
                 WHERE created_at::date = days.day), 0)::int AS contact,
       COALESCE((SELECT COUNT(*) FROM chat_conversations
                 WHERE created_at::date = days.day), 0)::int AS chatbot,
       COALESCE((SELECT COUNT(*) FROM assistant_sessions
                 WHERE platform='whatsapp' AND created_at::date = days.day), 0)::int AS wa,
       COALESCE((SELECT COUNT(*) FROM assistant_sessions
                 WHERE platform='telegram' AND created_at::date = days.day), 0)::int AS tg,
       COALESCE((SELECT COUNT(*) FROM assistant_sessions
                 WHERE platform='instagram' AND created_at::date = days.day), 0)::int AS ig
     FROM days ORDER BY days.day ASC`
  ).catch(() => []);
  return rows;
}

type TopPost = {
  id: number;
  caption: string;
  post_id: string;
  published_at: string;
  likes: number;
  comments: number;
  reach: number;
};

async function loadTopIgPosts(): Promise<TopPost[]> {
  return await query<TopPost>(
    `SELECT
       id,
       COALESCE(instagram_caption, '') as caption,
       instagram_post_id as post_id,
       to_char(instagram_published_at, 'YYYY-MM-DD') as published_at,
       COALESCE((instagram_insights->>'likes')::int, 0) as likes,
       COALESCE((instagram_insights->>'comments')::int, 0) as comments,
       COALESCE((instagram_insights->>'reach')::int, 0) as reach
     FROM marketing_briefs
     WHERE instagram_status='published' AND instagram_insights IS NOT NULL
     ORDER BY COALESCE((instagram_insights->>'reach')::int, 0) DESC
     LIMIT 5`
  ).catch(() => []);
}

function euro(cents: number): string {
  if (!cents) return "—";
  return `${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

function StackedBarChart({
  data,
}: {
  data: Array<{ day: string; contact: number; chatbot: number; wa: number; tg: number; ig: number }>;
}) {
  const max = Math.max(
    1,
    ...data.map((d) => d.contact + d.chatbot + d.wa + d.tg + d.ig)
  );
  const W = 780;
  const H = 200;
  const barW = W / data.length - 2;

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} width="100%" style={{ maxWidth: "100%" }}>
      {data.map((d, i) => {
        const x = i * (W / data.length);
        const total = d.contact + d.chatbot + d.wa + d.tg + d.ig;
        const scale = H / max;
        let y = H;
        const segments = [
          { v: d.contact, color: "#E4C58A" },
          { v: d.chatbot, color: "#9DB29A" },
          { v: d.wa, color: "#25D366" },
          { v: d.tg, color: "#3EC8F5" },
          { v: d.ig, color: "#E1306C" },
        ];
        return (
          <g key={d.day}>
            {segments.map((s, si) => {
              const h = s.v * scale;
              y -= h;
              return (
                <rect
                  key={si}
                  x={x + 1}
                  y={y}
                  width={barW}
                  height={h}
                  fill={s.color}
                  opacity={0.85}
                >
                  <title>{`${d.day} · ${s.v}`}</title>
                </rect>
              );
            })}
            {i % 5 === 0 || i === data.length - 1 ? (
              <text
                x={x + barW / 2}
                y={H + 16}
                fontSize="9"
                fill="rgba(244,239,227,0.55)"
                textAnchor="middle"
              >
                {d.day.slice(5)}
              </text>
            ) : null}
            <text
              x={x + barW / 2}
              y={H - 4}
              fontSize="8"
              fill="rgba(244,239,227,0.35)"
              textAnchor="middle"
            >
              {total > 0 ? total : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function AnalyticsPage() {
  const [kpi, timeline, topPosts] = await Promise.all([
    loadKpis(),
    loadTimeline30(),
    loadTopIgPosts(),
  ]);

  const totalLeads = kpi.messages30 + kpi.chatbotLeads30;
  const totalConversations = kpi.waSessions30 + kpi.tgSessions30 + kpi.igSessions30;

  return (
    <div>
      <section className="agents-hero" style={{ marginBottom: 22 }}>
        <div className="agents-hero__eyebrow">Analytics</div>
        <h1 className="agents-hero__title">
          Vue <em>d'ensemble</em>
        </h1>
        <p className="agents-hero__lead">
          L'entonnoir complet des 30 derniers jours : leads entrants →
          conversations → clients. Toutes sources croisées.
        </p>
      </section>

      {/* KPIs top-line */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>KPI · 30 derniers jours</h2>
        <div className="agent-kpi-grid">
          <div className="agent-kpi agent-kpi--default">
            <div className="agent-kpi__value">{totalLeads}</div>
            <div className="agent-kpi__label">Leads entrants</div>
          </div>
          <div className="agent-kpi agent-kpi--default">
            <div className="agent-kpi__value">{totalConversations}</div>
            <div className="agent-kpi__label">Conversations</div>
          </div>
          <div className="agent-kpi agent-kpi--ok">
            <div className="agent-kpi__value">{kpi.contactsThisMonth}</div>
            <div className="agent-kpi__label">Nouveaux clients CRM</div>
          </div>
          <div
            className={`agent-kpi agent-kpi--${
              kpi.revenueLast30Cents > 0 ? "ok" : "muted"
            }`}
          >
            <div className="agent-kpi__value">{euro(kpi.revenueLast30Cents)}</div>
            <div className="agent-kpi__label">CA facturé (30j)</div>
          </div>
          <div
            className={`agent-kpi agent-kpi--${
              kpi.approvalsPending > 0 ? "err" : "muted"
            }`}
          >
            <div className="agent-kpi__value">{kpi.approvalsPending}</div>
            <div className="agent-kpi__label">Brouillons IA à valider</div>
          </div>
        </div>
      </div>

      {/* Timeline 30 j */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Timeline · flux quotidien</h2>
        <div style={{ overflowX: "auto", padding: "10px 4px 0" }}>
          <StackedBarChart data={timeline} />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 12 }}>
          <Legend color="#E4C58A" label="Contact form" />
          <Legend color="#9DB29A" label="Chatbot" />
          <Legend color="#25D366" label="WhatsApp" />
          <Legend color="#3EC8F5" label="Telegram" />
          <Legend color="#E1306C" label="Instagram DM" />
        </div>
      </div>

      {/* Détail par canal */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Répartition par canal · 30 j</h2>
        <table className="agent-stats-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th style={{ textAlign: "right" }}>Sessions</th>
              <th style={{ textAlign: "right" }}>Part</th>
            </tr>
          </thead>
          <tbody>
            <ChannelRow label="Contact form" value={kpi.messages30} total={totalLeads + totalConversations} />
            <ChannelRow label="Chatbot site" value={kpi.chatbotLeads30} total={totalLeads + totalConversations} />
            <ChannelRow label="WhatsApp" value={kpi.waSessions30} total={totalLeads + totalConversations} />
            <ChannelRow label="Telegram" value={kpi.tgSessions30} total={totalLeads + totalConversations} />
            <ChannelRow label="Instagram DM" value={kpi.igSessions30} total={totalLeads + totalConversations} />
          </tbody>
        </table>
      </div>

      {/* Top posts IG */}
      <div className="agent-panel">
        <h2>Top posts Instagram</h2>
        {topPosts.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucune publication IG avec insights encore. Elles apparaîtront ici
            après le cron auto-refresh (toutes les 6 h).
          </p>
        ) : (
          <table className="agent-stats-table">
            <thead>
              <tr>
                <th>Publié</th>
                <th>Caption (extrait)</th>
                <th style={{ textAlign: "right" }}>♡ Likes</th>
                <th style={{ textAlign: "right" }}>💬 Comments</th>
                <th style={{ textAlign: "right" }}>👁 Reach</th>
              </tr>
            </thead>
            <tbody>
              {topPosts.map((p) => (
                <tr key={p.id}>
                  <td>{p.published_at}</td>
                  <td style={{ fontSize: 12.5 }}>
                    <Link href="/admin/agents/marketing?tab=briefs" style={{ color: "inherit" }}>
                      {p.caption.slice(0, 80)}
                      {p.caption.length > 80 ? "…" : ""}
                    </Link>
                  </td>
                  <td style={{ textAlign: "right" }}>{p.likes}</td>
                  <td style={{ textAlign: "right" }}>{p.comments}</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{p.reach}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-block",
          width: 12,
          height: 12,
          borderRadius: 2,
          background: color,
        }}
      />
      <span style={{ opacity: 0.8 }}>{label}</span>
    </div>
  );
}

function ChannelRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <tr>
      <td>{label}</td>
      <td style={{ textAlign: "right" }}>{value}</td>
      <td style={{ textAlign: "right", opacity: 0.7 }}>{pct.toFixed(1)}%</td>
    </tr>
  );
}
