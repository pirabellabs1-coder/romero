import Link from "next/link";
import { getDb } from "@/lib/db";
import { BarChart, HBarChart, Donut } from "@/components/admin/charts";

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

function getCounts(): Counts {
  const db = getDb();
  return {
    galleries: (db.prepare("SELECT COUNT(*) as c FROM galleries").get() as { c: number }).c,
    photos: (db.prepare("SELECT COUNT(*) as c FROM photos WHERE filename != 'hero.jpg'").get() as { c: number }).c,
    posts: (db.prepare("SELECT COUNT(*) as c FROM posts").get() as { c: number }).c,
    reviews: (db.prepare("SELECT COUNT(*) as c FROM reviews").get() as { c: number }).c,
    messages: (db.prepare("SELECT COUNT(*) as c FROM messages").get() as { c: number }).c,
    unread: (db.prepare("SELECT COUNT(*) as c FROM messages WHERE read_at IS NULL").get() as { c: number }).c,
  };
}

/** Build a 30-day buckets array ending today */
function messagesPer30Days(): { label: string; value: number }[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT substr(created_at, 1, 10) as d, COUNT(*) as c
      FROM messages
      WHERE created_at >= datetime('now', '-29 days')
      GROUP BY d
    `)
    .all() as { d: string; c: number }[];
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

function photosByGallery(): { label: string; value: number }[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT g.names AS label, COUNT(p.id) AS value
      FROM galleries g
      LEFT JOIN photos p ON p.gallery_id = g.id AND p.filename != 'hero.jpg'
      WHERE g.published = 1
      GROUP BY g.id
      ORDER BY value DESC
    `)
    .all() as { label: string; value: number }[];
}

function galleriesByRegion(): { label: string; value: number }[] {
  const db = getDb();
  return db
    .prepare(`SELECT region AS label, COUNT(*) AS value FROM galleries WHERE published = 1 GROUP BY region`)
    .all() as { label: string; value: number }[];
}

function postsByCategory(): { label: string; value: number }[] {
  const db = getDb();
  return db
    .prepare(`SELECT category AS label, COUNT(*) AS value FROM posts WHERE published = 1 GROUP BY category ORDER BY value DESC`)
    .all() as { label: string; value: number }[];
}

export default function AdminDashboard() {
  const counts = getCounts();
  const messagesDaily = messagesPer30Days();
  const galleryPhotos = photosByGallery();
  const regions = galleriesByRegion();
  const categories = postsByCategory();

  const latestMessages = getDb()
    .prepare(
      "SELECT id, first_name, last_name, email, place, created_at, read_at FROM messages ORDER BY created_at DESC LIMIT 5"
    )
    .all() as LatestMessage[];

  const stat = (label: string, value: number, href: string, tone?: "gold") => (
    <Link href={href} key={label} className="stat-card">
      <div className="admin-label" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="serif" style={{ fontSize: 38, color: tone === "gold" ? "var(--gold)" : "var(--forest)", marginTop: 4, lineHeight: 1 }}>
        {value}
      </div>
    </Link>
  );

  return (
    <>
      <h1 className="admin-h1">Tableau de bord</h1>
      <p className="admin-sub">Vue d&apos;ensemble du site.</p>

      <div className="dashboard-stats">
        {stat("Galeries", counts.galleries, "/admin/galleries")}
        {stat("Photos", counts.photos, "/admin/galleries")}
        {stat("Articles", counts.posts, "/admin/posts")}
        {stat("Avis", counts.reviews, "/admin/reviews")}
        {stat("Messages", counts.messages, "/admin/messages")}
        {stat("Non lus", counts.unread, "/admin/messages", counts.unread > 0 ? "gold" : undefined)}
      </div>

      <div className="dashboard-charts">
        <div className="admin-card chart-card chart-wide">
          <h2 className="chart-title">Messages reçus — 30 derniers jours</h2>
          <BarChart data={messagesDaily} height={180} />
        </div>

        <div className="admin-card chart-card">
          <h2 className="chart-title">Photos par galerie</h2>
          <HBarChart data={galleryPhotos} />
        </div>

        <div className="admin-card chart-card">
          <h2 className="chart-title">Galeries par région</h2>
          <Donut data={regions} />
        </div>

        <div className="admin-card chart-card">
          <h2 className="chart-title">Articles par catégorie</h2>
          <Donut data={categories} palette={["#9DB29A", "#B8975A", "#2E3D2E", "#C2A878"]} />
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 22, color: "var(--forest)" }}>
            Derniers messages
          </h2>
          <Link href="/admin/messages" className="cap-tracked-sm gold">
            Tout voir →
          </Link>
        </div>
        {latestMessages.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Aucun message pour le moment.</p>
        ) : (
          <div className="admin-table-wrap"><table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Lieu</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {latestMessages.map((m) => (
                <tr key={m.id}>
                  <td>{m.created_at}</td>
                  <td>
                    <Link href={`/admin/messages/${m.id}`}>
                      {m.first_name} {m.last_name}
                    </Link>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{m.email}</td>
                  <td style={{ color: "var(--muted)" }}>{m.place}</td>
                  <td style={{ color: m.read_at ? "var(--muted)" : "var(--gold)" }}>
                    {m.read_at ? "Lu" : "Nouveau"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
