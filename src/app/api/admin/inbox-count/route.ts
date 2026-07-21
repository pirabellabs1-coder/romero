/**
 * GET /api/admin/inbox-count
 * ────────────────────────────
 * Endpoint léger pour le polling client-side. Renvoie les compteurs
 * unread par canal + total, pour que le composant Inbox affiche un
 * toast et rafraîchisse quand un nouveau message arrive.
 *
 * Réservé aux admins connectés (session cookie).
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [contact, chatbot, assistant, pendingApprovals] = await Promise.all([
    queryOne<{ c: number; last: string | null }>(
      `SELECT COUNT(*)::int as c, MAX(created_at)::text as last FROM messages WHERE read_at IS NULL`
    ),
    queryOne<{ c: number; last: string | null }>(
      `SELECT COUNT(*)::int as c, MAX(updated_at)::text as last FROM chat_conversations WHERE notified = FALSE`
    ),
    queryOne<{ c: number; last: string | null }>(
      `SELECT COUNT(*)::int as c, MAX(updated_at)::text as last FROM assistant_sessions`
    ),
    queryOne<{ c: number }>(
      `SELECT COUNT(*)::int as c FROM pending_approvals WHERE status = 'pending'`
    ),
  ]);

  const lastActivity = [contact?.last, chatbot?.last, assistant?.last]
    .filter(Boolean)
    .sort()
    .pop();

  return NextResponse.json({
    ok: true,
    unread: {
      contact: contact?.c ?? 0,
      chatbot: chatbot?.c ?? 0,
      total: (contact?.c ?? 0) + (chatbot?.c ?? 0),
    },
    pendingApprovals: pendingApprovals?.c ?? 0,
    assistantSessions: assistant?.c ?? 0,
    lastActivity,
  });
}
