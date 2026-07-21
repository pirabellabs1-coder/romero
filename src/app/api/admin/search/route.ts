/**
 * GET /api/admin/search?q=xxx
 * ────────────────────────────
 * Recherche unifiée cross-sections pour la palette de commandes Cmd+K.
 * Renvoie top 5 par catégorie.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchHit = {
  kind: "contact" | "lead" | "gallery" | "message" | "approval" | "brief";
  id: number;
  title: string;
  subtitle?: string;
  href: string;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, hits: [] });

  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  // Contacts CRM
  try {
    const rows = await query<{
      id: number;
      name: string;
      email: string | null;
      wedding_date: string | null;
    }>(
      `SELECT id, name, email, to_char(wedding_date, 'YYYY-MM-DD') as wedding_date
       FROM admin_contacts
       WHERE name ILIKE $1 OR email ILIKE $1 OR wedding_location ILIKE $1
       ORDER BY updated_at DESC NULLS LAST LIMIT 5`,
      [like]
    );
    for (const r of rows)
      hits.push({
        kind: "contact",
        id: r.id,
        title: r.name,
        subtitle:
          [r.email, r.wedding_date && `Mariage ${r.wedding_date}`]
            .filter(Boolean)
            .join(" · ") || undefined,
        href: `/admin/agents/admin?tab=contacts`,
      });
  } catch {}

  // Messages formulaire de contact
  try {
    const rows = await query<{
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      message: string;
    }>(
      `SELECT id, first_name, last_name, email, message
       FROM messages
       WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR message ILIKE $1
       ORDER BY created_at DESC LIMIT 5`,
      [like]
    );
    for (const r of rows)
      hits.push({
        kind: "message",
        id: r.id,
        title: `${r.first_name} ${r.last_name}`.trim(),
        subtitle: `${r.email} · ${r.message.slice(0, 60)}${r.message.length > 60 ? "…" : ""}`,
        href: `/admin/inbox?open=contact_${r.id}`,
      });
  } catch {}

  // Galleries
  try {
    const rows = await query<{
      id: number;
      names: string;
      place: string;
      date_label: string;
    }>(
      `SELECT id, names, place, date_label FROM galleries
       WHERE names ILIKE $1 OR place ILIKE $1 OR date_label ILIKE $1
       ORDER BY sort_order DESC LIMIT 5`,
      [like]
    );
    for (const r of rows)
      hits.push({
        kind: "gallery",
        id: r.id,
        title: r.names,
        subtitle: [r.date_label, r.place].filter(Boolean).join(" · "),
        href: `/admin/galleries?edit=${r.id}`,
      });
  } catch {}

  // Approvals en attente / envoyées
  try {
    const rows = await query<{
      id: number;
      contact_name: string;
      contact_email: string;
      status: string;
    }>(
      `SELECT id, contact_name, contact_email, status
       FROM pending_approvals
       WHERE contact_name ILIKE $1 OR contact_email ILIKE $1 OR original_message ILIKE $1
       ORDER BY created_at DESC LIMIT 5`,
      [like]
    );
    for (const r of rows)
      hits.push({
        kind: "approval",
        id: r.id,
        title: r.contact_name,
        subtitle: `${r.contact_email} · ${r.status}`,
        href: `/admin/approvals`,
      });
  } catch {}

  // Chatbot leads
  try {
    const rows = await query<{
      id: number;
      lead_data: Record<string, unknown>;
    }>(
      `SELECT id, lead_data FROM chat_conversations
       WHERE (lead_data->>'contact_name') ILIKE $1
          OR (lead_data->>'contact_email') ILIKE $1
          OR (lead_data->>'wedding_location') ILIKE $1
       ORDER BY updated_at DESC LIMIT 5`,
      [like]
    );
    for (const r of rows) {
      const ld = r.lead_data || {};
      const name =
        (typeof ld.contact_name === "string" && ld.contact_name) ||
        (typeof ld.contact_email === "string" && ld.contact_email) ||
        `Visiteur #${r.id}`;
      hits.push({
        kind: "lead",
        id: r.id,
        title: name,
        subtitle:
          (typeof ld.wedding_location === "string" && ld.wedding_location) ||
          undefined,
        href: `/admin/inbox?open=chat_${r.id}`,
      });
    }
  } catch {}

  return NextResponse.json({ ok: true, hits });
}
