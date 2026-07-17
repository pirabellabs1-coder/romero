// Persistance des conversations du chatbot public + envoi de l'e-mail
// lead à Mickael. Séparé de lib/agents.ts pour rester léger côté API :
// la route /api/chat n'a besoin de rien de plus que ce module + agents.
import { unstable_noStore as noStore } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";

// ─── Types ─────────────────────────────────────────────────────────────
export type LeadData = {
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  wedding_date?: string;
  wedding_location?: string;
  guest_count?: number;
  preferred_formula?: string;
  style_notes?: string;
  budget_range?: string;
  how_found?: string;
};

export type ChatConversation = {
  id: number;
  session_id: string;
  agent_slug: string;
  lead_data: LeadData;
  notified: boolean;
  notified_at: string | null;
  user_agent: string | null;
  referrer: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls: unknown | null;
  duration_ms: number | null;
  created_at: string;
};

// ─── Conversations ─────────────────────────────────────────────────────
export async function getOrCreateConversation(
  sessionId: string,
  meta: { user_agent?: string | null; referrer?: string | null } = {}
): Promise<ChatConversation> {
  const existing = await queryOne<ChatConversation>(
    `SELECT * FROM chat_conversations WHERE session_id = $1`,
    [sessionId]
  );
  if (existing) return existing;
  const row = await queryOne<ChatConversation>(
    `INSERT INTO chat_conversations (session_id, user_agent, referrer)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [sessionId, meta.user_agent ?? null, meta.referrer ?? null]
  );
  if (!row) throw new Error("Impossible de créer la conversation");
  return row;
}

export async function getConversation(
  sessionId: string
): Promise<ChatConversation | null> {
  return queryOne<ChatConversation>(
    `SELECT * FROM chat_conversations WHERE session_id = $1`,
    [sessionId]
  );
}

export async function updateLeadData(
  conversationId: number,
  patch: LeadData
): Promise<void> {
  // Nettoyage : on ne conserve que les champs non-vides. On veut éviter
  // qu'un tool-call remplace un contact_email connu par une string vide
  // parce que Claude a renvoyé l'objet complet.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return;
  await execute(
    `UPDATE chat_conversations
     SET lead_data = lead_data || $1::jsonb, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(cleaned), conversationId]
  );
}

export async function markConversationNotified(
  conversationId: number
): Promise<void> {
  await execute(
    `UPDATE chat_conversations
     SET notified = TRUE, notified_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );
}

export async function incrementMessageCount(
  conversationId: number,
  by: number
): Promise<void> {
  await execute(
    `UPDATE chat_conversations
     SET message_count = message_count + $1, updated_at = NOW()
     WHERE id = $2`,
    [by, conversationId]
  );
}

// ─── Messages ──────────────────────────────────────────────────────────
export async function addMessage(entry: {
  conversation_id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown;
  duration_ms?: number;
}): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO chat_messages (conversation_id, role, content, tool_calls, duration_ms)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [
      entry.conversation_id,
      entry.role,
      entry.content,
      entry.tool_calls ? JSON.stringify(entry.tool_calls) : null,
      entry.duration_ms ?? null,
    ]
  );
  return row?.id ?? 0;
}

export async function listMessages(
  conversationId: number
): Promise<ChatMessageRow[]> {
  return query<ChatMessageRow>(
    `SELECT id, conversation_id, role, content, tool_calls, duration_ms, created_at
     FROM chat_messages WHERE conversation_id = $1
     ORDER BY id ASC`,
    [conversationId]
  );
}

// ─── Vues admin ────────────────────────────────────────────────────────
export type ConversationSummary = ChatConversation & {
  last_user_message: string | null;
  last_assistant_message: string | null;
};

export async function listConversations(
  limit = 50
): Promise<ConversationSummary[]> {
  noStore();
  return query<ConversationSummary>(
    `SELECT
        c.*,
        (SELECT content FROM chat_messages
         WHERE conversation_id = c.id AND role = 'user'
         ORDER BY id DESC LIMIT 1) AS last_user_message,
        (SELECT content FROM chat_messages
         WHERE conversation_id = c.id AND role = 'assistant'
         ORDER BY id DESC LIMIT 1) AS last_assistant_message
     FROM chat_conversations c
     ORDER BY c.updated_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getConversationById(
  id: number
): Promise<ChatConversation | null> {
  noStore();
  return queryOne<ChatConversation>(
    `SELECT * FROM chat_conversations WHERE id = $1`,
    [id]
  );
}

// ─── Formatage e-mail lead ─────────────────────────────────────────────
export function renderLeadEmailHtml(input: {
  lead: LeadData;
  summary: string;
  conversation: Array<{ role: string; content: string }>;
  siteUrl: string;
  conversationId: number;
}): string {
  const { lead, summary, conversation, siteUrl, conversationId } = input;
  const val = (v: unknown) =>
    v === undefined || v === null || v === "" ? "—" : String(v);

  const rows: Array<[string, unknown]> = [
    ["Nom", lead.contact_name],
    ["E-mail", lead.contact_email],
    ["Téléphone", lead.contact_phone],
    ["Date du mariage", lead.wedding_date],
    ["Lieu", lead.wedding_location],
    ["Invités", lead.guest_count],
    ["Formule pressentie", lead.preferred_formula],
    ["Budget évoqué", lead.budget_range],
    ["Source", lead.how_found],
    ["Notes de style", lead.style_notes],
  ];

  const transcript = conversation
    .map((m) => {
      const label = m.role === "user" ? "Visiteur" : "Assistant";
      const bg = m.role === "user" ? "#F8F4EC" : "#F0E8D8";
      const border = m.role === "user" ? "#B8975A" : "#2E3D2E";
      return `
      <tr><td style="padding:12px 0;">
        <div style="background:${bg};border-left:3px solid ${border};padding:10px 14px;border-radius:2px;">
          <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8E7340;margin-bottom:6px;">${label}</div>
          <div style="font-size:14px;line-height:1.55;color:#2A2520;white-space:pre-wrap;">${escapeHtml(m.content)}</div>
        </div>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F4EC;font-family:'Cormorant Garamond',Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F4EC;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border:1px solid #E8DFCE;">
        <tr><td style="background:#2E3D2E;padding:26px 32px;color:#F4EFE3;">
          <div style="font-size:11px;letter-spacing:0.26em;text-transform:uppercase;color:#D4B57A;">Nouveau lead qualifié</div>
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-style:italic;margin-top:6px;">${escapeHtml(val(lead.contact_name))}</div>
          <div style="font-size:13px;margin-top:4px;opacity:0.8;">via l'assistant du site</div>
        </td></tr>
        <tr><td style="padding:28px 32px 6px;font-family:Inter,sans-serif;">
          <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-style:italic;color:#2E3D2E;margin:0 0 12px;">Résumé de l'assistant</h2>
          <div style="background:#F8F4EC;padding:16px 18px;border-left:3px solid #B8975A;color:#2A2520;font-size:14px;line-height:1.65;">${escapeHtml(summary)}</div>
        </td></tr>
        <tr><td style="padding:20px 32px;font-family:Inter,sans-serif;">
          <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-style:italic;color:#2E3D2E;margin:0 0 12px;">Informations collectées</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#2A2520;">
            ${rows
              .map(
                ([k, v]) => `
              <tr>
                <td style="padding:8px 0;width:180px;color:#7A6E5C;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;vertical-align:top;">${k}</td>
                <td style="padding:8px 0;color:#2A2520;">${escapeHtml(String(val(v)))}</td>
              </tr>`
              )
              .join("")}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;font-family:Inter,sans-serif;">
          <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-style:italic;color:#2E3D2E;margin:0 0 12px;">Transcription de la conversation</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${transcript}
          </table>
        </td></tr>
        <tr><td style="padding:22px 32px 30px;font-family:Inter,sans-serif;border-top:1px solid #E8DFCE;text-align:center;">
          <a href="${siteUrl}/admin/agents/site?tab=conversations&conv=${conversationId}"
             style="display:inline-block;background:#2E3D2E;color:#F4EFE3;padding:12px 22px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;text-decoration:none;">
            Ouvrir dans le dashboard
          </a>
          <div style="margin-top:14px;font-size:11px;color:#7A6E5C;">Conversation ${conversationId} · ${new Date().toLocaleString("fr-FR")}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
