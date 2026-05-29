// Full health check: DB integrity + public site smoke test + DB read latencies.
// Run anytime to confirm everything's healthy: node supabase/health-check.js
const { Client } = require("pg");
const DB_URL = "postgresql://postgres.igzotmjfvbfnzxstdvpm:6RHhC82aa%23857mE@aws-1-eu-north-1.pooler.supabase.com:6543/postgres";

const PUBLIC_PATHS = [
  "/",
  "/a-propos",
  "/prestations",
  "/portfolio",
  "/portfolio/anastasia-jordan",
  "/portfolio/manon-kevin",
  "/blog",
  "/avis",
  "/contact",
  "/mentions-legales",
  "/politique-confidentialite",
];

const TABLES = [
  "users", "settings", "galleries", "photos", "posts", "reviews",
  "messages", "page_content", "page_sections",
];

(async () => {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log("═══════════════════════════════════════════════════");
  console.log("  Romero — HEALTH CHECK");
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. Table counts ────────────────────────────────────────────
  console.log("── 1. Table counts ──");
  for (const t of TABLES) {
    const { rows } = await c.query(`SELECT COUNT(*)::int as n FROM ${t}`);
    console.log(`  ${t.padEnd(15)} = ${rows[0].n}`);
  }

  // ── 2. Referential integrity ───────────────────────────────────
  console.log("\n── 2. Référential integrity ──");
  const dangling = (await c.query(`
    SELECT g.id, g.names, g.cover_photo_id
    FROM galleries g LEFT JOIN photos p ON p.id = g.cover_photo_id
    WHERE g.cover_photo_id IS NOT NULL AND p.id IS NULL
  `)).rows;
  if (dangling.length === 0) console.log("  ✓ Aucune cover orpheline.");
  else dangling.forEach((g) => console.log(`  ❌ Galerie ${g.id} (${g.names}) pointe sur photo ${g.cover_photo_id} qui n'existe pas.`));

  const orphanPhotos = (await c.query(`
    SELECT COUNT(*)::int as n FROM photos p
    WHERE p.gallery_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM galleries g WHERE g.id = p.gallery_id)
  `)).rows[0].n;
  if (orphanPhotos === 0) console.log("  ✓ Aucune photo orpheline.");
  else console.log(`  ❌ ${orphanPhotos} photo(s) sans galerie parente.`);

  // ── 3. Public site smoke test + latencies ──────────────────────
  console.log("\n── 3. Pages publiques (latence en ms) ──");
  for (const path of PUBLIC_PATHS) {
    const url = `https://romerophotography.fr${path}`;
    const start = Date.now();
    try {
      const res = await fetch(url, { cache: "no-store" });
      const ms = Date.now() - start;
      const flag = res.ok ? "✓" : "❌";
      console.log(`  ${flag} ${res.status}  ${ms.toString().padStart(5)}ms  ${path}`);
    } catch (e) {
      console.log(`  ❌ ERR  ${path}  → ${e.message}`);
    }
  }

  // ── 4. DB query latencies ──────────────────────────────────────
  console.log("\n── 4. Latence des queries clés (ms) ──");
  const benchmarks = [
    ["listGalleries publiée", "SELECT g.*, p.filename AS cover_filename FROM galleries g LEFT JOIN photos p ON p.id = g.cover_photo_id WHERE g.published = 1 ORDER BY g.sort_order, g.id"],
    ["listPhotos Anastasia",   "SELECT * FROM photos WHERE gallery_id = 1 ORDER BY sort_order, id"],
    ["getPageContent home fr", "SELECT key, value FROM page_content WHERE page = 'home' AND lang = 'fr'"],
    ["listSectionsForSlot bottom", "SELECT * FROM page_sections WHERE page = 'home' AND slot = 'bottom' ORDER BY position"],
    ["count messages unread",  "SELECT COUNT(*)::int FROM messages WHERE read_at IS NULL"],
  ];
  for (const [label, sql] of benchmarks) {
    const start = Date.now();
    await c.query(sql);
    console.log(`  ${(Date.now() - start).toString().padStart(4)}ms  ${label}`);
  }

  // ── 5. CMS state ───────────────────────────────────────────────
  console.log("\n── 5. État du CMS ──");
  const overrideCounts = (await c.query(`
    SELECT page, COUNT(*)::int as n FROM page_content GROUP BY page ORDER BY page
  `)).rows;
  if (overrideCounts.length === 0) console.log("  Aucune personnalisation pour l'instant.");
  else overrideCounts.forEach((r) => console.log(`  ${r.page.padEnd(12)} = ${r.n} override(s)`));

  const sectionCounts = (await c.query(`
    SELECT page, slot, COUNT(*)::int as n FROM page_sections GROUP BY page, slot ORDER BY page, slot
  `)).rows;
  if (sectionCounts.length === 0) console.log("  Aucune section custom.");
  else sectionCounts.forEach((r) => console.log(`  ${r.page} :: ${r.slot.padEnd(16)} = ${r.n} section(s)`));

  await c.end();
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Health check terminé.");
  console.log("═══════════════════════════════════════════════════");
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
