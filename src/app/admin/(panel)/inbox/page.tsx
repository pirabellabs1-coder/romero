/**
 * Inbox unifié
 * ─────────────
 * Une page unique pour voir TOUTES les conversations qui arrivent
 * (peu importe le canal) :
 *   • Formulaires de contact du site (table messages)
 *   • Chatbot site widget (chat_conversations + chat_messages)
 *   • WhatsApp Cloud API (assistant_sessions[platform='whatsapp'])
 *   • Telegram bot (assistant_sessions[platform='telegram'])
 *
 * Affichage 2 colonnes : liste des threads à gauche + détail du thread
 * ouvert à droite. Filtres par canal + recherche.
 */
import type { Metadata } from "next";
import { query, queryOne, execute } from "@/lib/db";
import Inbox, { type UnifiedThread, type ThreadMessage } from "./Inbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Inbox — Romero Photography",
};

const LIMIT = 200;

async function loadContactMessages(): Promise<UnifiedThread[]> {
  const rows = await query<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    place: string;
    message: string;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id, first_name, last_name, email, place, message, read_at, created_at
     FROM messages
     ORDER BY created_at DESC
     LIMIT $1`,
    [LIMIT]
  );
  return rows.map((r) => ({
    id: `contact_${r.id}`,
    channel: "contact",
    contactName: `${r.first_name} ${r.last_name}`.trim() || r.email,
    contactId: r.email,
    lastMessageAt: r.created_at,
    lastMessagePreview: r.message.replace(/\s+/g, " ").slice(0, 140),
    unread: !r.read_at,
    messageCount: 1,
    extra: { place: r.place, email: r.email },
  }));
}

async function loadChatConversations(): Promise<UnifiedThread[]> {
  const rows = await query<{
    id: number;
    session_id: string;
    lead_data: Record<string, unknown>;
    message_count: number;
    notified: boolean;
    created_at: string;
    updated_at: string;
    last_preview: string | null;
  }>(
    `SELECT c.id, c.session_id, c.lead_data, c.message_count, c.notified,
            c.created_at, c.updated_at,
            (SELECT content FROM chat_messages
             WHERE conversation_id = c.id AND role = 'user'
             ORDER BY created_at DESC LIMIT 1) AS last_preview
     FROM chat_conversations c
     ORDER BY c.updated_at DESC
     LIMIT $1`,
    [LIMIT]
  );
  return rows.map((r) => {
    const ld = r.lead_data || {};
    const first =
      (typeof ld.first_name === "string" && ld.first_name) ||
      (typeof ld.name === "string" && ld.name) ||
      "";
    const last =
      typeof ld.last_name === "string" && ld.last_name ? ld.last_name : "";
    const email =
      typeof ld.email === "string" && ld.email ? ld.email : undefined;
    const displayName =
      `${first} ${last}`.trim() || email || `Visiteur #${r.id}`;
    return {
      id: `chat_${r.id}`,
      channel: "chatbot",
      contactName: displayName,
      contactId: email,
      lastMessageAt: r.updated_at,
      lastMessagePreview: (r.last_preview ?? "").replace(/\s+/g, " ").slice(0, 140),
      unread: !r.notified,
      messageCount: r.message_count,
      extra: { session_id: r.session_id, lead_data: ld },
    };
  });
}

async function loadAssistantSessions(): Promise<UnifiedThread[]> {
  const rows = await query<{
    id: number;
    platform: string;
    platform_user_id: string;
    display_name: string | null;
    message_count: number;
    created_at: string;
    updated_at: string;
    last_preview: string | null;
  }>(
    `SELECT s.id, s.platform, s.platform_user_id, s.display_name,
            s.message_count, s.created_at, s.updated_at,
            (SELECT content FROM assistant_messages
             WHERE session_id = s.id AND role = 'user'
             ORDER BY created_at DESC LIMIT 1) AS last_preview
     FROM assistant_sessions s
     ORDER BY s.updated_at DESC
     LIMIT $1`,
    [LIMIT]
  );
  return rows.map((r) => {
    const channel =
      r.platform === "whatsapp"
        ? ("whatsapp" as const)
        : r.platform === "instagram"
        ? ("instagram" as const)
        : ("telegram" as const);
    const displayFallback =
      r.platform === "whatsapp"
        ? `+${r.platform_user_id}`
        : r.platform === "instagram"
        ? `IG user ${r.platform_user_id.slice(0, 12)}`
        : r.platform_user_id;
    return {
      id: `assistant_${r.id}`,
      channel,
      contactName: r.display_name || displayFallback,
      contactId: r.platform_user_id,
      lastMessageAt: r.updated_at,
      lastMessagePreview: (r.last_preview ?? "").replace(/\s+/g, " ").slice(0, 140),
      unread: false,
      messageCount: r.message_count,
      extra: { platform: r.platform, platform_user_id: r.platform_user_id },
    };
  });
}

async function loadThreadMessages(
  threadId: string
): Promise<ThreadMessage[]> {
  const [prefix, idStr] = threadId.split("_");
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return [];

  if (prefix === "contact") {
    const r = await queryOne<{
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      place: string;
      wedding_date: string;
      message: string;
      created_at: string;
    }>(
      `SELECT first_name, last_name, email, phone, place, wedding_date, message, created_at
       FROM messages WHERE id = $1`,
      [id]
    );
    if (!r) return [];
    const meta = [
      r.email && `Email : ${r.email}`,
      r.phone && `Téléphone : ${r.phone}`,
      r.place && `Lieu : ${r.place}`,
      r.wedding_date && `Date mariage : ${r.wedding_date}`,
    ]
      .filter(Boolean)
      .join("\n");
    return [
      {
        id: `contact_${id}_meta`,
        role: "system",
        content: meta || "(Aucune info supplémentaire)",
        createdAt: r.created_at,
      },
      {
        id: `contact_${id}_msg`,
        role: "user",
        content: r.message,
        createdAt: r.created_at,
      },
    ];
  }

  if (prefix === "chat") {
    return await query<ThreadMessage>(
      `SELECT ('cm_' || id::text) AS id, role, content, created_at AS "createdAt"
       FROM chat_messages
       WHERE conversation_id = $1 AND role IN ('user','assistant')
       ORDER BY created_at ASC
       LIMIT 500`,
      [id]
    );
  }

  if (prefix === "assistant") {
    return await query<ThreadMessage>(
      `SELECT ('am_' || id::text) AS id, role, content, created_at AS "createdAt"
       FROM assistant_messages
       WHERE session_id = $1 AND role IN ('user','assistant')
       ORDER BY created_at ASC
       LIMIT 500`,
      [id]
    );
  }

  return [];
}

async function markAsReadIfNeeded(threadId: string | undefined): Promise<void> {
  if (!threadId) return;
  const [prefix, idStr] = threadId.split("_");
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return;
  if (prefix === "contact") {
    await execute(
      `UPDATE messages SET read_at = NOW() WHERE id = $1 AND read_at IS NULL`,
      [id]
    ).catch(() => {});
  } else if (prefix === "chat") {
    await execute(
      `UPDATE chat_conversations SET notified = TRUE, notified_at = NOW()
       WHERE id = $1 AND notified = FALSE`,
      [id]
    ).catch(() => {});
  }
  // Pour assistant_sessions : pas de champ "read" pour l'instant.
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: { open?: string; ch?: string; q?: string };
}) {
  const openId = searchParams?.open;

  // Marque comme lu SI on ouvre un thread (déclenché sur navigation).
  await markAsReadIfNeeded(openId);

  const [contact, chatbot, assistant, openMessages] = await Promise.all([
    loadContactMessages().catch(() => []),
    loadChatConversations().catch(() => []),
    loadAssistantSessions().catch(() => []),
    openId ? loadThreadMessages(openId) : Promise.resolve([] as ThreadMessage[]),
  ]);

  // Union + tri global
  const all = [...contact, ...chatbot, ...assistant].sort((a, b) => {
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const openThread = openId ? all.find((t) => t.id === openId) : undefined;

  return (
    <Inbox
      threads={all}
      openThread={openThread}
      openMessages={openMessages}
      initialChannel={
        searchParams?.ch === "chatbot" ||
        searchParams?.ch === "whatsapp" ||
        searchParams?.ch === "telegram" ||
        searchParams?.ch === "instagram" ||
        searchParams?.ch === "contact"
          ? searchParams.ch
          : "all"
      }
      initialQuery={searchParams?.q ?? ""}
    />
  );
}
