import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BarChart, HBarChart, Donut } from "@/components/admin/charts";
import { getSharedConfig } from "@/lib/studio-settings";
import { getAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";

type Counts = {
  galleries: number;
  photos: number;
  posts: number;
  reviews: number;
  messages: number;
  unread: number;
};

type LatestMessage = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  place: string;
  created_at: string;
  read_at: string | null;
};

async function getCounts(): Promise<Counts> {
  const [g, p, po, r, m, u] = await Promise.all([
    queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM galleries"),
    queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM photos WHERE filename != 'hero.jpg'"),
    queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM posts"),
    queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM reviews"),
    queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM messages"),
    queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM messages WHERE read_at IS NULL"),
  ]);
  return {
    galleries: g?.c ?? 0,
    photos: p?.c ?? 0,
    posts: po?.c ?? 0,
    reviews: r?.c ?? 0,
    messages: m?.c ?? 0,
    unread: u?.c ?? 0,
  };
}

async function messagesPer30Days(): Promise<{ label: string; value: number }[]> {
  const rows = await query<{ d: string; c: number }>(
    `SELECT to_char(created_at, 'YYYY-MM-DD') as d, COUNT(*)::int as c
     FROM messages
     WHERE created_at >= NOW() - INTERVAL '29 days'
     GROUP BY d`
  );
  const byDay = new Map(rows.map((r) => [r.d, r.c]));
  const out: { label: string; value: number }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ label: `${d.getDate()}`, value: byDay.get(iso) ?? 0 });
  }
  return out;
}

async function photosByGallery(): Promise<{ label: string; value: number }[]> {
  return query<{ label: string; value: number }>(
    `SELECT g.names AS label, COUNT(p.id)::int AS value
     FROM galleries g
     LEFT JOIN photos p ON p.gallery_id = g.id AND p.filename != 'hero.jpg'
     WHERE g.published = 1
     GROUP BY g.id
     ORDER BY value DESC`
  );
}

async function galleriesByRegion(): Promise<{ label: string; value: number }[]> {
  return query<{ label: string; value: number }>(
    `SELECT region AS label, COUNT(*)::int AS value FROM galleries WHERE published = 1 GROUP BY region`
  );
}

async function postsByCategory(): Promise<{ label: string; value: number }[]> {
  return query<{ label: string; value: number }>(
    `SELECT category AS label, COUNT(*)::int AS value FROM posts WHERE published = 1 GROUP BY category ORDER BY value DESC`
  );
}

async function getMessagesThisMonth(): Promise<number> {
  const r = await queryOne<{ c: number }>(
    "SELECT COUNT(*)::int as c FROM messages WHERE created_at >= date_trunc('month', NOW())"
  );
  return r?.c ?? 0;
}

function frenchDate(d: Date): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function initials(first: string, last: string): string {
  return `${(first || "?").charAt(0)}${(last || "").charAt(0)}`.toUpperCase();
}

function Icon({ name }: { name: "gallery" | "photo" | "article" | "review" | "mail" | "bell" }) {
  switch (name) {
    case "gallery":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    case "photo":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "article":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          <path d="M15 4v5h5" />
          <path d="M8 13h8M8 17h6" />
        </svg>
      );
    case "review":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6.5L22 9.3l-5.2 4.6L18.4 22 12 18.3 5.6 22l1.6-8.1L2 9.3l7.1-.8L12 2z" />
        </svg>
      );
    case "mail":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "bell":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2v1h16v-1l-2-2z" />
          <path d="M10 21h4" />
        </svg>
      );
  }
}

type StatProps = {
  label: string;
  value: number;
  hint?: string;
  href: string;
  icon: "gallery" | "photo" | "article" | "review" | "mail" | "bell";
  tone?: "default" | "gold";
};

function StatCard({ label, value, hint, href, icon, tone = "default" }: StatProps) {
  return (
    <Link href={href} className={`dash-stat${tone === "gold" ? " dash-stat--gold" : ""}`}>
      <div className="dash-stat__icon">
        <Icon name={icon} />
      </div>
      <div className="dash-stat__label">{label}</div>
      <div className="dash-stat__value serif">{value}</div>
      {hint && <div className="dash-stat__hint">{hint}</div>}
    </Link>
  );
}

export default async function AdminDashboard() {
  const [counts, messagesDaily, galleryPhotos, regions, categories, messagesThisMonth, latestMessages, shared, mkt, wa, nextWedding] =
    await Promise.all([
      getCounts(),
      messagesPer30Days(),
      photosByGallery(),
      galleriesByRegion(),
      postsByCategory(),
      getMessagesThisMonth(),
      query<LatestMessage>(
        "SELECT id, first_name, last_name, email, place, created_at, read_at FROM messages ORDER BY created_at DESC LIMIT 5"
      ),
      getSharedConfig().catch(() => ({} as Record<string, string>)),
      getAgent("marketing").catch(() => null),
      getAgent("whatsapp").catch(() => null),
      queryOne<{
        id: number;
        name: string;
        wedding_date: string;
        wedding_location: string | null;
        days_until: number;
      }>(
        `SELECT id, name, to_char(wedding_date, 'YYYY-MM-DD') as wedding_date,
                wedding_location, (wedding_date - CURRENT_DATE) AS days_until
         FROM admin_contacts
         WHERE wedding_date IS NOT NULL AND wedding_date >= CURRENT_DATE
         ORDER BY wedding_date ASC LIMIT 1`
      ).catch(() => null),
    ]);

  // Onboarding : bannière visible tant que tout n'est pas configuré.
  const mktCfg = (mkt?.config ?? {}) as Record<string, string>;
  const waCfg = (wa?.config ?? {}) as Record<string, string>;
  const onboardingStatus = {
    company: !!(shared.siret && shared.legal_name),
    instagram: !!(mktCfg.meta_access_token && mktCfg.instagram_business_id),
    google: !!waCfg.google_refresh_token,
  };
  const onboardingDone =
    onboardingStatus.company && onboardingStatus.instagram && onboardingStatus.google;
  const onboardingCount =
    (onboardingStatus.company ? 1 : 0) +
    (onboardingStatus.instagram ? 1 : 0) +
    (onboardingStatus.google ? 1 : 0);

  const user = getCurrentUser();
  const userHandle = user?.email
    ? user.email.split("@")[0].split(".")[0].replace(/^\w/, (c) => c.toUpperCase())
    : "Mickael";

  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "Bonne soirée"
    : hour < 12 ? "Bonjour"
    : hour < 18 ? "Bon après-midi"
    : "Bonsoir";

  return (
    <>
      <header className="dash-hero">
        <div className="dash-hero__caps cap-tracked-sm gold">{frenchDate(new Date())}</div>
        <h1 className="dash-hero__title serif">
          {greeting}, <em>{userHandle}</em>.
        </h1>
        <p className="dash-hero__sub">
          {counts.unread > 0
            ? <>Vous avez <strong style={{ color: "var(--gold-deep)" }}>{counts.unread} nouveau{counts.unread > 1 ? "x" : ""} message{counts.unread > 1 ? "s" : ""}</strong> à consulter.</>
            : "Tout est à jour. Voici un aperçu de votre activité."}
        </p>
      </header>

      {!onboardingDone ? (
        <section
          style={{
            marginBottom: 22,
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid rgba(184,151,90,0.35)",
            background: "linear-gradient(90deg, rgba(184,151,90,0.08), rgba(184,151,90,0.02))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gold-deep)",
                marginBottom: 6,
              }}
            >
              Configuration initiale — {onboardingCount}/3
            </div>
            <strong style={{ fontSize: 16 }}>
              Tes agents attendent leur configuration
            </strong>
            <div style={{ fontSize: 13.5, opacity: 0.8, marginTop: 4 }}>
              3 minutes chrono : ton entreprise (auto-remplie via SIRET), Instagram et
              Google Agenda (1 clic chacun).
            </div>
          </div>
          <Link
            href="/admin/onboarding"
            className="agent-btn agent-btn--primary"
            style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Configurer maintenant →
          </Link>
        </section>
      ) : null}

      {nextWedding ? (
        <section
          style={{
            marginBottom: 22,
            padding: "18px 22px",
            borderRadius: 8,
            border: `1px solid ${
              nextWedding.days_until <= 7
                ? "rgba(228,138,138,0.4)"
                : nextWedding.days_until <= 30
                ? "rgba(184,151,90,0.4)"
                : "rgba(157,206,157,0.35)"
            }`,
            background:
              nextWedding.days_until <= 7
                ? "rgba(228,138,138,0.08)"
                : nextWedding.days_until <= 30
                ? "rgba(184,151,90,0.08)"
                : "rgba(157,206,157,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 22,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              minWidth: 90,
              textAlign: "center",
              padding: "4px 12px",
              borderRight: "1px solid rgba(184,151,90,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 300,
                lineHeight: 1,
                color:
                  nextWedding.days_until <= 7
                    ? "#E48A8A"
                    : nextWedding.days_until <= 30
                    ? "var(--gold-deep)"
                    : "#9DCE9D",
              }}
            >
              J-{nextWedding.days_until}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(184,151,90,0.7)",
                marginBottom: 4,
              }}
            >
              Prochain mariage
            </div>
            <strong style={{ fontSize: 17 }}>💒 {nextWedding.name}</strong>
            <div style={{ fontSize: 13.5, opacity: 0.8, marginTop: 4 }}>
              {new Date(nextWedding.wedding_date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {nextWedding.wedding_location ? ` · 📍 ${nextWedding.wedding_location}` : ""}
            </div>
          </div>
          <Link
            href="/admin/calendar"
            className="agent-btn"
            style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Voir calendrier →
          </Link>
        </section>
      ) : null}

      <section className="dash-stats">
        <StatCard label="Galeries"  value={counts.galleries}    href="/admin/galleries" icon="gallery" />
        <StatCard label="Photos"    value={counts.photos}       href="/admin/galleries" icon="photo"  hint="Hors hero" />
        <StatCard label="Articles"  value={counts.posts}        href="/admin/posts"     icon="article" />
        <StatCard label="Avis"      value={counts.reviews}      href="/admin/reviews"   icon="review" />
        <StatCard label="Messages"  value={counts.messages}     href="/admin/messages"  icon="mail"   hint={`${messagesThisMonth} ce mois-ci`} />
        <StatCard label="Non lus"   value={counts.unread}       href="/admin/messages"  icon="bell"   tone={counts.unread > 0 ? "gold" : "default"} />
      </section>

      <section className="dash-charts">
        <div className="dash-chart dash-chart--wide">
          <header className="dash-chart__head">
            <h2 className="dash-chart__title serif">Messages reçus</h2>
            <span className="dash-chart__sub">30 derniers jours</span>
          </header>
          <BarChart data={messagesDaily} height={180} />
        </div>

        <div className="dash-chart">
          <header className="dash-chart__head">
            <h2 className="dash-chart__title serif">Photos par galerie</h2>
            <span className="dash-chart__sub">Mariages publiés</span>
          </header>
          <HBarChart data={galleryPhotos} />
        </div>

        <div className="dash-chart">
          <header className="dash-chart__head">
            <h2 className="dash-chart__title serif">Galeries par région</h2>
            <span className="dash-chart__sub">Répartition</span>
          </header>
          <Donut data={regions} />
        </div>

        <div className="dash-chart">
          <header className="dash-chart__head">
            <h2 className="dash-chart__title serif">Articles par catégorie</h2>
            <span className="dash-chart__sub">Blog publié</span>
          </header>
          <Donut data={categories} palette={["#9DB29A", "#B8975A", "#2E3D2E", "#C2A878"]} />
        </div>
      </section>

      <section className="dash-messages">
        <header className="dash-section-head">
          <div>
            <h2 className="dash-section-head__title serif">Derniers messages</h2>
            <p className="dash-section-head__sub">Demandes de contact récentes</p>
          </div>
          <Link href="/admin/messages" className="dash-section-head__link cap-tracked-sm">
            Voir tout →
          </Link>
        </header>

        {latestMessages.length === 0 ? (
          <div className="dash-empty">
            <Icon name="mail" />
            <p>Aucun message pour le moment.</p>
          </div>
        ) : (
          <ul className="dash-msg-list">
            {latestMessages.map((m) => (
              <li key={m.id} className={`dash-msg${m.read_at ? "" : " is-unread"}`}>
                <Link href={`/admin/messages/${m.id}`} className="dash-msg__link">
                  <span className="dash-msg__avatar">{initials(m.first_name, m.last_name)}</span>
                  <div className="dash-msg__body">
                    <div className="dash-msg__row1">
                      <span className="dash-msg__name">
                        {m.first_name} {m.last_name}
                      </span>
                      <span className="dash-msg__when">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="dash-msg__row2">
                      <span className="dash-msg__email">{m.email}</span>
                      {m.place && (
                        <>
                          <span className="dash-msg__dot" aria-hidden>·</span>
                          <span className="dash-msg__place">{m.place}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!m.read_at && <span className="dash-msg__badge">Nouveau</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
