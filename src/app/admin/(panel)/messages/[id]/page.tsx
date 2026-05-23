import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { markRead, markUnread, deleteMessage } from "../actions";
import MarkReadOnView from "@/components/admin/MarkReadOnView";
import ConfirmDelete from "@/components/admin/ConfirmDelete";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  wedding_date: string;
  place: string;
  message: string;
  lang: string;
  read_at: string | null;
  created_at: string;
};

export default function MessageDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const m = getDb().prepare("SELECT * FROM messages WHERE id = ?").get(id) as Row | undefined;
  if (!m) notFound();

  const wasUnread = !m.read_at;
  const onUnread = markUnread.bind(null, id);
  const onDelete = deleteMessage.bind(null, id);
  const onMarkRead = markRead.bind(null, id);

  return (
    <>
      {wasUnread && <MarkReadOnView action={onMarkRead} />}
      <Link href="/admin/messages" className="cap-tracked-sm gold">
        ← TOUS LES MESSAGES
      </Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>
        {m.first_name} {m.last_name}
      </h1>
      <p className="admin-sub">Reçu le {m.created_at}</p>

      <div className="admin-card">
        <div className="admin-grid cols-2" style={{ marginBottom: 24 }}>
          <Info label="Email" value={<a href={`mailto:${m.email}`} style={{ color: "var(--gold)" }}>{m.email}</a>} />
          <Info label="Téléphone" value={m.phone ? <a href={`tel:${m.phone}`} style={{ color: "var(--gold)" }}>{m.phone}</a> : "—"} />
          <Info label="Date du mariage" value={m.wedding_date || "—"} />
          <Info label="Lieu" value={m.place || "—"} />
          <Info label="Langue" value={m.lang.toUpperCase()} />
        </div>

        <div className="admin-label">Message</div>
        <div
          style={{
            background: "var(--cream)",
            border: "1px solid var(--rule)",
            padding: 22,
            borderRadius: 4,
            fontSize: 15,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            color: "var(--ink)",
            marginTop: 8,
          }}
        >
          {m.message}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <a className="admin-btn" href={`mailto:${m.email}?subject=${encodeURIComponent("Romero Photography")}`}>
            RÉPONDRE PAR EMAIL
          </a>
          <form action={onUnread}>
            <button className="admin-btn ghost" type="submit">Marquer comme non lu</button>
          </form>
          <ConfirmDelete action={onDelete} label="Supprimer" confirmText="Supprimer ce message ?" />
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="admin-label">{label}</div>
      <div style={{ fontSize: 15, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
