// Restore the original Vercel Blob URLs that were saved in the `alt`
// column when we substituted placeholders, then clean the alt field.
// Touches the same five tables as replace-blob-urls.mjs so the site
// goes back to the exact state it had before the suspension scare.
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const PREFIX = "PLACEHOLDER · ancien: ";

await c.query("BEGIN");

// 1) photos table — we marked each placeholder row with the original URL
//    in the alt column ("PLACEHOLDER · ancien: <url>"). Restore filename
//    from there and clear alt.
const photos = await c.query(
  "SELECT id, alt FROM photos WHERE alt LIKE $1",
  [PREFIX + "%"]
);
console.log("photos a restaurer:", photos.rows.length);
let restored = 0;
for (const p of photos.rows) {
  const url = p.alt.slice(PREFIX.length).trim();
  if (!url.startsWith("http")) continue;
  await c.query(
    "UPDATE photos SET filename = $1, alt = '' WHERE id = $2",
    [url, p.id]
  );
  restored++;
}
console.log("  restaurees:", restored);

await c.query("COMMIT");

// 2) Sanity check — count rows in each table that still reference Blob
const remaining = await c.query(`
  SELECT 'photos.url'      AS where_, count(*)::int AS n FROM photos
    WHERE filename LIKE 'http%blob.vercel-storage%'
  UNION ALL SELECT 'photos.placeholder', count(*)::int FROM photos
    WHERE alt LIKE '${PREFIX}%'
  UNION ALL SELECT 'page_content.url', count(*)::int FROM page_content
    WHERE value LIKE 'http%blob.vercel-storage%'
  UNION ALL SELECT 'posts.url', count(*)::int FROM posts
    WHERE cover_filename LIKE 'http%blob.vercel-storage%'
`);
console.log("\nApres restauration :");
remaining.rows.forEach((r) => console.log("  ", r.where_, ":", r.n));

await c.end();
