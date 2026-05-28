// End-to-end persistence test: simulates the original bug scenario.
// Reverts to initial state at the end.
const { Client } = require("pg");

const DB_URL = "postgresql://postgres.igzotmjfvbfnzxstdvpm:6RHhC82aa%23857mE@aws-1-eu-north-1.pooler.supabase.com:6543/postgres";

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // 1. Initial state — Manon & Kevin gallery
  const g0 = (await c.query("SELECT id, slug, cover_photo_id FROM galleries WHERE slug = $1", ["manon-kevin"])).rows[0];
  const p0 = (await c.query("SELECT id, filename FROM photos WHERE id = $1", [g0.cover_photo_id])).rows[0];
  console.log("═══ Test de persistance bout-en-bout ═══");
  console.log("");
  console.log("▶ État initial — Galerie « Manon & Kevin »");
  console.log("  cover_photo_id =", g0.cover_photo_id, "→", p0.filename);

  // 2. What does the public site serve BEFORE the change?
  const url = "https://romerophotography.fr/portfolio/manon-kevin?nocache=" + Date.now();
  const html1 = await (await fetch(url, { cache: "no-store" })).text();
  const rx = /(galleries\/g[^"\\]+\.webp|uploads\/galleries\/[^"\\]+\.webp)/;
  const m1 = html1.match(rx);
  console.log("  site public lit  →", m1 ? m1[1] : "AUCUNE PHOTO TROUVÉE");

  // 3. Find a DIFFERENT photo to use as the new cover
  const alt = (await c.query(
    "SELECT id, filename FROM photos WHERE gallery_id = $1 AND id != $2 ORDER BY sort_order LIMIT 1",
    [g0.id, g0.cover_photo_id]
  )).rows[0];
  console.log("");
  console.log("▶ Modification — nouvelle couverture choisie");
  console.log("  photo_id =", alt.id, "→", alt.filename);

  // 4. UPDATE (equivalent to clicking "Set as cover" in the admin)
  await c.query("UPDATE galleries SET cover_photo_id = $1 WHERE id = $2", [alt.id, g0.id]);

  // Tiny moment for any in-flight cache to settle
  await new Promise(r => setTimeout(r, 1500));

  // 5. Read what the public site serves AFTER the change (cache-busted)
  const html2 = await (await fetch(url + "&v=2", { cache: "no-store", headers: { "cache-control": "no-cache" } })).text();
  const m2 = html2.match(rx);
  console.log("");
  console.log("▶ Vérification — site public APRÈS modification");
  console.log("  site public lit  →", m2 ? m2[1] : "AUCUNE PHOTO TROUVÉE");

  // 6. Confirm DB persisted
  const g1 = (await c.query("SELECT cover_photo_id FROM galleries WHERE id = $1", [g0.id])).rows[0];
  console.log("  DB confirme      →", g1.cover_photo_id, "(attendu:", alt.id + ")");
  const persisted = g1.cover_photo_id === alt.id;
  console.log("");
  console.log(persisted ? "✅ PERSISTÉ EN DB" : "❌ PAS PERSISTÉ");

  // 7. RESTORE initial state
  await c.query("UPDATE galleries SET cover_photo_id = $1 WHERE id = $2", [g0.cover_photo_id, g0.id]);
  const g2 = (await c.query("SELECT cover_photo_id FROM galleries WHERE id = $1", [g0.id])).rows[0];
  console.log("");
  console.log("▶ Restauration — état initial remis");
  console.log("  cover_photo_id =", g2.cover_photo_id, "(attendu:", g0.cover_photo_id + ")");
  await c.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
