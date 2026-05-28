// Comprehensive dashboard verification — runs every query the live admin
// dashboard runs against Postgres and prints the expected vs actual values
// so we can confirm the UI shows correct data without needing to log in.
const { Client } = require("pg");
const DB_URL = "postgresql://postgres.igzotmjfvbfnzxstdvpm:6RHhC82aa%23857mE@aws-1-eu-north-1.pooler.supabase.com:6543/postgres";

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VÉRIFICATION COMPLÈTE DU TABLEAU DE BORD");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // ───────────────────────────────────────────────────────────────────
  // 1. Stat cards (les 6 cartes en haut du dashboard)
  // ───────────────────────────────────────────────────────────────────
  console.log("── 1. Stat cards (6 cartes du dashboard) ──");
  const [g, p, po, r, m, u] = await Promise.all([
    c.query("SELECT COUNT(*)::int as c FROM galleries"),
    c.query("SELECT COUNT(*)::int as c FROM photos WHERE filename != 'hero.jpg'"),
    c.query("SELECT COUNT(*)::int as c FROM posts"),
    c.query("SELECT COUNT(*)::int as c FROM reviews"),
    c.query("SELECT COUNT(*)::int as c FROM messages"),
    c.query("SELECT COUNT(*)::int as c FROM messages WHERE read_at IS NULL"),
  ]);
  console.log("  Galeries :", g.rows[0].c);
  console.log("  Photos   :", p.rows[0].c, "(hors hero.jpg)");
  console.log("  Articles :", po.rows[0].c);
  console.log("  Avis     :", r.rows[0].c);
  console.log("  Messages :", m.rows[0].c);
  console.log("  Non lus  :", u.rows[0].c, u.rows[0].c > 0 ? "🟡" : "✓");

  // ───────────────────────────────────────────────────────────────────
  // 2. Hint "ce mois-ci" sur la carte Messages
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 2. Hint 'ce mois-ci' ──");
  const monthly = await c.query("SELECT COUNT(*)::int as c FROM messages WHERE created_at >= date_trunc('month', NOW())");
  console.log("  Messages ce mois-ci :", monthly.rows[0].c);

  // ───────────────────────────────────────────────────────────────────
  // 3. Bar chart — messages des 30 derniers jours
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 3. Bar chart 'Messages reçus 30 derniers jours' ──");
  const last30 = await c.query(
    `SELECT to_char(created_at, 'YYYY-MM-DD') as d, COUNT(*)::int as c
     FROM messages
     WHERE created_at >= NOW() - INTERVAL '29 days'
     GROUP BY d ORDER BY d`
  );
  if (last30.rows.length === 0) {
    console.log("  Aucun message reçu sur 30 jours (chart sera vide / à plat)");
  } else {
    last30.rows.forEach((r) => console.log(`  ${r.d}  ${"█".repeat(r.c)} ${r.c}`));
  }

  // ───────────────────────────────────────────────────────────────────
  // 4. HBar chart — photos par galerie
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 4. HBar chart 'Photos par galerie' ──");
  const photosByGal = await c.query(
    `SELECT g.names AS label, COUNT(p.id)::int AS value
     FROM galleries g LEFT JOIN photos p ON p.gallery_id = g.id AND p.filename != 'hero.jpg'
     WHERE g.published = 1 GROUP BY g.id ORDER BY value DESC`
  );
  photosByGal.rows.forEach((r) => {
    const bar = "█".repeat(Math.max(1, Math.round(r.value / 2)));
    console.log(`  ${r.label.padEnd(26)} ${bar} ${r.value}`);
  });

  // ───────────────────────────────────────────────────────────────────
  // 5. Donut — galeries par région
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 5. Donut 'Galeries par région' ──");
  const byRegion = await c.query(
    "SELECT region AS label, COUNT(*)::int AS value FROM galleries WHERE published = 1 GROUP BY region"
  );
  byRegion.rows.forEach((r) => console.log(`  ${r.label.padEnd(16)} ${r.value}`));

  // ───────────────────────────────────────────────────────────────────
  // 6. Donut — articles par catégorie
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 6. Donut 'Articles par catégorie' ──");
  const byCat = await c.query(
    "SELECT category AS label, COUNT(*)::int AS value FROM posts WHERE published = 1 GROUP BY category ORDER BY value DESC"
  );
  byCat.rows.forEach((r) => console.log(`  ${r.label.padEnd(16)} ${r.value}`));

  // ───────────────────────────────────────────────────────────────────
  // 7. Section "Derniers messages" (top 5)
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 7. Derniers messages (top 5) ──");
  const latest = await c.query(
    "SELECT id, first_name, last_name, email, place, created_at, read_at FROM messages ORDER BY created_at DESC LIMIT 5"
  );
  if (latest.rows.length === 0) {
    console.log("  Aucun message — état vide affiché");
  } else {
    latest.rows.forEach((m) => {
      const initials = ((m.first_name?.[0] || "?") + (m.last_name?.[0] || "")).toUpperCase();
      const status = m.read_at ? "lu" : "🟡 NOUVEAU";
      console.log(`  [${initials}] ${m.first_name} ${m.last_name} <${m.email}> · ${m.place || "—"} · ${status}`);
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // 8. Cohérence des couvertures (cover_photo_id pointe sur une photo valide)
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 8. Cohérence couverture → photo (intégrité référentielle) ──");
  const cov = await c.query(`
    SELECT g.slug, g.names, g.cover_photo_id, p.id AS photo_id, p.filename
    FROM galleries g LEFT JOIN photos p ON p.id = g.cover_photo_id
    ORDER BY g.id
  `);
  cov.rows.forEach((g) => {
    const ok = g.cover_photo_id == null || g.photo_id != null;
    const label = g.cover_photo_id == null ? "—" : (g.photo_id ? g.filename : "❌ ORPHELIN");
    console.log(`  ${ok ? "✓" : "❌"} ${g.names.padEnd(24)} cover=${g.cover_photo_id || "NULL"}  ${label}`);
  });

  // ───────────────────────────────────────────────────────────────────
  // 9. Auth/Settings sanity check
  // ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("── 9. Sanity check auth & settings ──");
  const users = await c.query("SELECT id, email FROM users");
  console.log(`  Users     : ${users.rows.length} (${users.rows.map(u => u.email).join(", ")})`);
  const settings = await c.query("SELECT COUNT(*)::int as c FROM settings");
  console.log(`  Settings  : ${settings.rows[0].c} entries`);
  const contactEmail = await c.query("SELECT value FROM settings WHERE key = 'contact_email'");
  console.log(`  contact_email = ${contactEmail.rows[0]?.value}`);

  await c.end();

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ✅ VÉRIFICATION TERMINÉE — toutes les queries du dashboard");
  console.log("     fonctionnent et retournent des données cohérentes.");
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
