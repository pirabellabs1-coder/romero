import Link from "next/link";
import { listBriefsForAdmin } from "../marketing-actions";

/**
 * Vue calendrier éditorial pour l'agent marketing.
 * ────────────────────────────────────────────────
 * Trois sections : mois en cours (grille), semaine à venir (agenda),
 * historique récent (liste). Un même brief peut apparaître dans deux
 * sections s'il est programmé dans le mois courant.
 *
 * Chaque « case » est cliquable et renvoie vers le brief dans l'onglet
 * Briefs (?tab=briefs&conv=<id>).
 *
 * Zéro dépendance externe — calcul manuel du calendrier.
 */
export default async function CalendarView() {
  const briefs = await listBriefsForAdmin(200).catch(() => []);

  // Regroupe par jour ISO (YYYY-MM-DD)
  type Slot = {
    briefId: number;
    kind: "published" | "scheduled" | "linkedin_copied" | "blog_draft";
    title: string;
    time?: string;
  };
  const byDay = new Map<string, Slot[]>();
  for (const b of briefs) {
    // Instagram publié
    if (b.instagram_status === "published" && b.instagram_published_at) {
      const day = b.instagram_published_at.slice(0, 10);
      const time = new Date(b.instagram_published_at).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const arr = byDay.get(day) || [];
      arr.push({
        briefId: b.id,
        kind: "published",
        title: (b.instagram_caption || b.brief_text || "").slice(0, 60),
        time,
      });
      byDay.set(day, arr);
    }
    // Instagram programmé
    if (b.instagram_status === "scheduled" && b.instagram_scheduled_for) {
      const day = b.instagram_scheduled_for.slice(0, 10);
      const time = new Date(b.instagram_scheduled_for).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const arr = byDay.get(day) || [];
      arr.push({
        briefId: b.id,
        kind: "scheduled",
        title: (b.instagram_caption || b.brief_text || "").slice(0, 60),
        time,
      });
      byDay.set(day, arr);
    }
    // LinkedIn copié
    if (b.linkedin_status === "copied" && b.linkedin_copied_at) {
      const day = b.linkedin_copied_at.slice(0, 10);
      const arr = byDay.get(day) || [];
      arr.push({
        briefId: b.id,
        kind: "linkedin_copied",
        title: (b.linkedin_post || "").slice(0, 60),
      });
      byDay.set(day, arr);
    }
    // Blog draft créé
    if (b.blog_post_id) {
      const day = b.updated_at.slice(0, 10);
      const arr = byDay.get(day) || [];
      arr.push({
        briefId: b.id,
        kind: "blog_draft",
        title: b.blog_title || "",
      });
      byDay.set(day, arr);
    }
  }

  // Comptes globaux
  const scheduled = briefs.filter((b) => b.instagram_status === "scheduled").length;
  const publishedThisMonth = briefs.filter(
    (b) =>
      b.instagram_published_at &&
      new Date(b.instagram_published_at).getMonth() === new Date().getMonth() &&
      new Date(b.instagram_published_at).getFullYear() === new Date().getFullYear()
  ).length;
  const linkedinThisMonth = briefs.filter(
    (b) =>
      b.linkedin_copied_at &&
      new Date(b.linkedin_copied_at).getMonth() === new Date().getMonth()
  ).length;
  const blogThisMonth = briefs.filter(
    (b) =>
      b.blog_post_id &&
      new Date(b.updated_at).getMonth() === new Date().getMonth()
  ).length;

  // Génère la grille du mois courant
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthLabel = today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  // Jour de la semaine (0 = dimanche, on veut lundi = 0)
  const firstWeekDay = (monthStart.getDay() + 6) % 7;
  const days: Array<{ date: Date; slots: Slot[]; isToday: boolean } | null> = [];
  for (let i = 0; i < firstWeekDay; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    const key = date.toISOString().slice(0, 10);
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
    days.push({ date, slots: byDay.get(key) || [], isToday });
  }

  // Upcoming : les 10 prochains éléments (posts scheduled à venir)
  const upcoming = briefs
    .filter(
      (b) =>
        b.instagram_status === "scheduled" &&
        b.instagram_scheduled_for &&
        new Date(b.instagram_scheduled_for).getTime() > Date.now()
    )
    .sort((a, b) => a.instagram_scheduled_for!.localeCompare(b.instagram_scheduled_for!))
    .slice(0, 10);

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* KPI du mois */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>Vue calendrier — {monthLabel}</h2>
          <div className="agent-kpi-grid">
            <div className="agent-kpi agent-kpi--ok">
              <div className="agent-kpi__value">{publishedThisMonth}</div>
              <div className="agent-kpi__label">Publiés IG</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{scheduled}</div>
              <div className="agent-kpi__label">Programmés IG</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{linkedinThisMonth}</div>
              <div className="agent-kpi__label">LinkedIn ce mois</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{blogThisMonth}</div>
              <div className="agent-kpi__label">Articles blog ce mois</div>
            </div>
          </div>
        </div>

        {/* Grille du mois */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2 style={{ textTransform: "capitalize" }}>{monthLabel}</h2>
          <div className="mkt-cal-grid">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} className="mkt-cal-head">
                {d}
              </div>
            ))}
            {days.map((day, i) => {
              if (!day) return <div key={i} className="mkt-cal-day mkt-cal-day--empty" />;
              return (
                <div
                  key={i}
                  className={`mkt-cal-day ${day.isToday ? "mkt-cal-day--today" : ""}`}
                >
                  <div className="mkt-cal-day__num">{day.date.getDate()}</div>
                  {day.slots.length > 0 ? (
                    <div className="mkt-cal-day__slots">
                      {day.slots.slice(0, 3).map((s, j) => (
                        <Link
                          key={j}
                          href={`/admin/agents/marketing?tab=briefs&conv=${s.briefId}`}
                          className={`mkt-cal-slot mkt-cal-slot--${s.kind}`}
                          title={s.title}
                        >
                          {s.time ? `${s.time} · ` : ""}
                          {s.kind === "published"
                            ? "✓ IG"
                            : s.kind === "scheduled"
                            ? "📅 IG"
                            : s.kind === "linkedin_copied"
                            ? "in"
                            : "📝"}
                        </Link>
                      ))}
                      {day.slots.length > 3 ? (
                        <div className="mkt-cal-slot mkt-cal-slot--more">
                          +{day.slots.length - 3}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 14, fontSize: 11, opacity: 0.75, flexWrap: "wrap" }}>
            <Legend color="#9DCE9D" label="Publié IG" />
            <Legend color="#E0B96A" label="Programmé IG" />
            <Legend color="#6B8E5E" label="LinkedIn copié" />
            <Legend color="var(--gold-light, #D4B57A)" label="Article blog" />
          </div>
        </div>

        {/* Upcoming */}
        <div className="agent-panel">
          <h2>À venir — 10 prochains posts programmés</h2>
          {upcoming.length === 0 ? (
            <p style={{ opacity: 0.55, fontStyle: "italic" }}>
              Aucun post programmé. Utilisez le bouton « Programmer » sur un
              brief pour planifier une publication.
            </p>
          ) : (
            <div className="agent-pg-history">
              {upcoming.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/agents/marketing?tab=briefs&conv=${b.id}`}
                  className="agent-pg-turn"
                  style={{
                    textDecoration: "none",
                    display: "block",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      className="agent-badge agent-badge--installing"
                      style={{ padding: "3px 8px", fontSize: 9 }}
                    >
                      📅 Programmé
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "rgba(244,239,227,0.85)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {(b.instagram_caption || b.brief_text || "").slice(0, 80)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--gold-light, #D4B57A)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(b.instagram_scheduled_for!).toLocaleString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          background: color,
          borderRadius: 2,
        }}
      />
      {label}
    </span>
  );
}
