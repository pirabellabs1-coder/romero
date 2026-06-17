// Replace every Vercel Blob URL still referenced anywhere in the DB
// with a random local placeholder photo (/uploads/galleries/...).
// One-off, run from scripts/ via:
//   DATABASE_URL=... node scripts/replace-blob-urls.mjs
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const pool = await c.query(
  "SELECT filename FROM photos WHERE filename NOT LIKE 'http%' AND filename NOT LIKE '%hero%'"
);
const localPaths = pool.rows.map((x) => "/uploads/" + x.filename);
console.log("Pool de placeholders:", localPaths.length);

function pickPath() {
  return localPaths[Math.floor(Math.random() * localPaths.length)];
}

const BLOB_REGEX = /https:\/\/crqsj8bzda2jtevv\.public\.blob\.vercel-storage\.com\/[^"\s]+/g;

await c.query("BEGIN");

// 1) page_content
const pc = await c.query(
  "SELECT page, key, lang, value FROM page_content WHERE value LIKE 'http%blob.vercel-storage%' ORDER BY page, key"
);
console.log("page_content avec URL Blob:", pc.rows.length);
for (const row of pc.rows) {
  const pick = pickPath();
  await c.query(
    "UPDATE page_content SET value = $1 WHERE page = $2 AND key = $3 AND lang = $4",
    [pick, row.page, row.key, row.lang]
  );
}

// 2) posts (cover_filename)
const posts = await c.query(
  "SELECT id, slug, cover_filename FROM posts WHERE cover_filename LIKE 'http%blob.vercel-storage%'"
);
console.log("posts avec cover Blob:", posts.rows.length);
for (const p of posts.rows) {
  const pick = pickPath().replace(/^\/uploads\//, "");
  await c.query("UPDATE posts SET cover_filename = $1 WHERE id = $2", [pick, p.id]);
}

// 3) page_sections (data JSON may contain Blob URLs inside text-image, full-image, etc.)
const sections = await c.query(
  "SELECT id, page, slot, data FROM page_sections WHERE data::text LIKE '%blob.vercel-storage%'"
);
console.log("page_sections avec URL Blob:", sections.rows.length);
for (const s of sections.rows) {
  let str = JSON.stringify(s.data);
  str = str.replace(BLOB_REGEX, () => pickPath());
  await c.query("UPDATE page_sections SET data = $1 WHERE id = $2", [
    JSON.parse(str),
    s.id,
  ]);
}

// 4) settings table — some hero photos may live in settings
const settings = await c.query(
  "SELECT key, value FROM settings WHERE value::text LIKE '%blob.vercel-storage%'"
);
console.log("settings avec URL Blob:", settings.rows.length);
for (const s of settings.rows) {
  const replaced = (s.value || "").toString().replace(BLOB_REGEX, () => pickPath());
  await c.query("UPDATE settings SET value = $1 WHERE key = $2", [replaced, s.key]);
}

await c.query("COMMIT");

// 5) Final check across all tables
const remaining = await c.query(`
  SELECT 'page_content' AS table_name, count(*)::int AS n FROM page_content WHERE value LIKE 'http%blob.vercel-storage%'
  UNION ALL SELECT 'posts', count(*)::int FROM posts WHERE cover_filename LIKE 'http%blob.vercel-storage%'
  UNION ALL SELECT 'page_sections', count(*)::int FROM page_sections WHERE data::text LIKE '%blob.vercel-storage%'
  UNION ALL SELECT 'photos', count(*)::int FROM photos WHERE filename LIKE 'http%blob.vercel-storage%'
  UNION ALL SELECT 'settings', count(*)::int FROM settings WHERE value::text LIKE '%blob.vercel-storage%'
  UNION ALL SELECT 'galleries', count(*)::int FROM galleries WHERE cover_position LIKE '%blob.vercel-storage%'
`);
console.log("\nReferences Blob restantes :");
remaining.rows.forEach((r) => console.log("  ", r.table_name, ":", r.n));

await c.end();
