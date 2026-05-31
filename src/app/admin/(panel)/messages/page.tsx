import Link from "next/link";
import { query } from "@/lib/db";

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
  read_at: string | Date | null;
  created_at: string | Date;
};

function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function MessagesAdmin() {
  const rows = await query<Row>(
    "SELECT * FROM messages ORDER BY created_at DESC"
  );

  return (
    <>
      <h1 className="admin-h1">Messages</h1>
      <p className="admin-sub">Demandes reçues via le formulaire de contact.</p>

      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, padding: 28 }}>Aucun message pour le moment.</p>
        ) : (
          <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Mariage</th>
                <th>Lieu</th>
                <th>Lang</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ background: m.read_at ? "transparent" : "rgba(184, 151, 90, 0.06)" }}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--muted)" }}>{fmtDate(m.created_at)}</td>
                  <td>
                    <Link href={`/admin/messages/${m.id}`}>
                      {m.first_name} {m.last_name}
                    </Link>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{m.email}</td>
                  <td style={{ color: "var(--muted)" }}>{m.wedding_date}</td>
                  <td style={{ color: "var(--muted)" }}>{m.place}</td>
                  <td style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: 11 }}>{m.lang}</td>
                  <td style={{ color: m.read_at ? "var(--muted)" : "var(--gold)" }}>{m.read_at ? "Lu" : "Nouveau"}</td>
                  <td>
                    <Link href={`/admin/messages/${m.id}`} className="cap-tracked-sm gold">
                      VOIR →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
