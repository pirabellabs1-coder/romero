/**
 * Vue calendrier mariages
 * ────────────────────────
 * Timeline visuelle des mariages passés + à venir. Deux sources :
 *   • admin_contacts (CRM avec wedding_date renseignée) — futurs
 *   • galleries (mariages passés publiés)
 *
 * Groupé par année, avec countdown pour les prochains et statut
 * de préparation (nombre de docs signés, montant facturé).
 */
import Link from "next/link";
import type { Metadata } from "next";
import { query } from "@/lib/db";
import AddWeddingButton from "./AddWeddingButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Calendrier des mariages — Romero Photography",
};

type UpcomingWedding = {
  id: number;
  name: string;
  wedding_date: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  document_count: number;
  total_billed_cents: number;
  days_until: number;
};

type PastWedding = {
  id: number;
  names: string;
  place: string;
  date_label: string;
  region: string;
  slug: string;
  photo_count: number;
};

async function loadUpcoming(): Promise<UpcomingWedding[]> {
  const rows = await query<UpcomingWedding>(
    `SELECT
       id,
       name,
       to_char(wedding_date, 'YYYY-MM-DD') as wedding_date,
       wedding_location as location,
       email,
       phone,
       document_count,
       total_billed_cents,
       (wedding_date - CURRENT_DATE) AS days_until
     FROM admin_contacts
     WHERE wedding_date IS NOT NULL AND wedding_date >= CURRENT_DATE
     ORDER BY wedding_date ASC
     LIMIT 50`
  ).catch(() => []);
  return rows;
}

async function loadPast(): Promise<PastWedding[]> {
  return await query<PastWedding>(
    `SELECT g.id, g.names, g.place, g.date_label, g.region, g.slug,
            COALESCE(pc.n, 0) AS photo_count
     FROM galleries g
     LEFT JOIN (
       SELECT gallery_id, COUNT(*)::int AS n
       FROM photos WHERE filename != 'hero.jpg'
       GROUP BY gallery_id
     ) pc ON pc.gallery_id = g.id
     WHERE g.published = 1
     ORDER BY g.sort_order DESC, g.id DESC
     LIMIT 100`
  ).catch(() => []);
}

function euro(cents: number): string {
  if (!cents) return "—";
  return `${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

function frenchMonth(m: number): string {
  return [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ][m];
}

function humanDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${frenchMonth(d.getMonth())} ${d.getFullYear()}`;
}

function toneForDays(days: number): { color: string; label: string } {
  if (days <= 7) return { color: "#E48A8A", label: "Cette semaine" };
  if (days <= 30) return { color: "#B8975A", label: `Dans ${days} jours` };
  if (days <= 90) return { color: "#9DCE9D", label: `Dans ${days} jours` };
  const months = Math.round(days / 30);
  return { color: "rgba(157,178,154,0.7)", label: `Dans ${months} mois` };
}

export default async function CalendarPage() {
  const [upcoming, past] = await Promise.all([loadUpcoming(), loadPast()]);

  const total = upcoming.length + past.length;
  const nextWedding = upcoming[0];
  const totalUpcomingRevenue = upcoming.reduce(
    (a, w) => a + (w.total_billed_cents ?? 0),
    0
  );

  // Regroupement par année pour affichage
  const byYear = new Map<number, UpcomingWedding[]>();
  for (const w of upcoming) {
    const y = new Date(w.wedding_date).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(w);
  }
  const years = Array.from(byYear.keys()).sort();

  return (
    <div>
      <section className="agents-hero" style={{ marginBottom: 22 }}>
        <div className="agents-hero__eyebrow">Planning</div>
        <h1 className="agents-hero__title">
          Calendrier des <em>mariages</em>
        </h1>
        <p className="agents-hero__lead">
          Vue timeline des mariages à venir (via CRM) et déjà couverts (via
          galeries). {total} au total.
        </p>
      </section>

      {/* KPIs synthèse */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <div className="agent-kpi-grid">
          <div className="agent-kpi agent-kpi--default">
            <div className="agent-kpi__value">{upcoming.length}</div>
            <div className="agent-kpi__label">À venir</div>
          </div>
          <div className="agent-kpi agent-kpi--ok">
            <div className="agent-kpi__value">{past.length}</div>
            <div className="agent-kpi__label">Couverts (galerie)</div>
          </div>
          <div className="agent-kpi agent-kpi--muted">
            <div className="agent-kpi__value">
              {nextWedding ? `${nextWedding.days_until} j` : "—"}
            </div>
            <div className="agent-kpi__label">
              Prochain {nextWedding ? `· ${nextWedding.name.split(" ")[0]}` : ""}
            </div>
          </div>
          <div
            className={`agent-kpi agent-kpi--${
              totalUpcomingRevenue > 0 ? "ok" : "muted"
            }`}
          >
            <div className="agent-kpi__value">{euro(totalUpcomingRevenue)}</div>
            <div className="agent-kpi__label">CA à venir (facturé)</div>
          </div>
        </div>
      </div>

      {/* À venir */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <h2>Mariages à venir</h2>
          <AddWeddingButton />
        </div>
        {upcoming.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucun mariage à venir dans le CRM. Les mariages apparaîtront ici dès
            qu'ils seront enregistrés dans <code>admin_contacts</code> avec une
            date.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {years.map((year) => (
              <div key={year}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "rgba(184,151,90,0.75)",
                    fontWeight: 600,
                    marginBottom: 10,
                    borderBottom: "1px solid rgba(184,151,90,0.15)",
                    paddingBottom: 6,
                  }}
                >
                  {year}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byYear.get(year)!.map((w) => {
                    const tone = toneForDays(w.days_until);
                    return (
                      <div
                        key={w.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "14px 16px",
                          border: "1px solid rgba(184,151,90,0.15)",
                          borderLeft: `4px solid ${tone.color}`,
                          borderRadius: 4,
                          background: "rgba(0,0,0,0.08)",
                        }}
                      >
                        <div style={{ minWidth: 72, textAlign: "center" }}>
                          <div
                            style={{
                              fontSize: 26,
                              fontWeight: 500,
                              lineHeight: 1,
                              color: tone.color,
                            }}
                          >
                            {new Date(w.wedding_date).getDate()}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                              opacity: 0.6,
                              marginTop: 4,
                            }}
                          >
                            {frenchMonth(new Date(w.wedding_date).getMonth())}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 15 }}>{w.name}</div>
                          {w.location ? (
                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>
                              📍 {w.location}
                            </div>
                          ) : null}
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.55,
                              marginTop: 4,
                              display: "flex",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            {w.email ? <span>✉ {w.email}</span> : null}
                            {w.phone ? <span>☎ {w.phone}</span> : null}
                            {w.document_count > 0 ? (
                              <span>📄 {w.document_count} docs</span>
                            ) : null}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                              color: tone.color,
                              padding: "3px 8px",
                              border: `1px solid ${tone.color}`,
                              borderRadius: 3,
                              fontWeight: 600,
                            }}
                          >
                            {tone.label}
                          </span>
                          {w.total_billed_cents > 0 ? (
                            <span style={{ fontSize: 12, opacity: 0.7 }}>
                              {euro(w.total_billed_cents)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Boutons export */}
      <div
        className="agent-panel"
        style={{
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 14 }}>Export et impression</strong>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3 }}>
            Sauvegarde CRM ou impression du planning du mois courant.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/api/admin/export/user-guide"
            className="agent-btn agent-btn--primary"
            download
            title="Manuel complet de la plateforme (20 pages)"
          >
            📖 Manuel utilisateur
          </a>
          <a
            href={`/api/admin/export/calendar?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`}
            className="agent-btn"
            download
          >
            🖨 PDF ce mois
          </a>
          <a
            href="/api/admin/export/contacts?format=csv"
            className="agent-btn"
            download
          >
            📊 CSV (Excel)
          </a>
          <a
            href="/api/admin/export/contacts?format=vcard"
            className="agent-btn"
            download
          >
            📱 vCard (téléphone)
          </a>
        </div>
      </div>

      {/* Passés (galeries) */}
      <div className="agent-panel">
        <h2>Mariages couverts ({past.length})</h2>
        {past.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucune galerie publiée.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {past.map((g) => (
              <Link
                key={g.id}
                href={`/admin/galleries?edit=${g.id}`}
                style={{
                  padding: 14,
                  border: "1px solid rgba(184,151,90,0.15)",
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.08)",
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 14 }}>{g.names}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {g.date_label} · {g.place}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    opacity: 0.55,
                    marginTop: 4,
                  }}
                >
                  {g.region} · {g.photo_count} photos
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
