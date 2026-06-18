// Restore the page_content + posts CMS Blob URLs that I accidentally
// overwrote with placeholders. Strategy: each row's updated_at in
// page_content is within ~5 s of the corresponding Blob upload time
// (the upload happens, then the server action upserts the row), so
// we can match each placeholder row to the closest hero-* blob.
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// 1. Fetch all hero-* blobs (those were the CMS upload prefix)
async function listBlobs(prefix) {
  const res = await fetch(`https://blob.vercel-storage.com?prefix=${encodeURIComponent(prefix)}&limit=500`, {
    headers: { Authorization: `Bearer ${BLOB_TOKEN}`, "x-api-version": "7" },
  });
  const d = await res.json();
  return (d.blobs || []).map((b) => ({
    pathname: b.pathname,
    url: b.url,
    uploadedAt: new Date(b.uploadedAt).getTime(),
  }));
}

const heroBlobs = await listBlobs("posts/hero-");
const postBlobs = await listBlobs("posts/post");
console.log("posts/hero-* blobs:", heroBlobs.length);
console.log("posts/post* blobs:", postBlobs.length);

function closest(blobs, target) {
  // blob upload happens BEFORE server action upserts (a few seconds earlier),
  // so look for the blob with uploadedAt closest in the past.
  let best = null;
  let bestDiff = Infinity;
  for (const b of blobs) {
    const diff = target - b.uploadedAt;
    if (diff >= 0 && diff < bestDiff) {
      best = b;
      bestDiff = diff;
    }
  }
  return best ? { blob: best, lagMs: bestDiff } : null;
}

// 2. Restore page_content
const placeholders = await c.query(
  "SELECT page, key, lang, value, updated_at FROM page_content WHERE value LIKE '/uploads/galleries/%' ORDER BY page, key, lang"
);
console.log("\npage_content placeholders:", placeholders.rows.length);

await c.query("BEGIN");
let restored = 0;
let unmatched = [];
for (const row of placeholders.rows) {
  const ts = new Date(row.updated_at).getTime();
  const match = closest(heroBlobs, ts);
  if (!match || match.lagMs > 60_000) {
    unmatched.push({ ...row, lag: match?.lagMs });
    continue;
  }
  await c.query(
    "UPDATE page_content SET value = $1 WHERE page = $2 AND key = $3 AND lang = $4",
    [match.blob.url, row.page, row.key, row.lang]
  );
  console.log(
    `  ${row.page}.${row.key} [${row.lang}] -> ${match.blob.pathname.slice(0, 80)} (lag ${match.lagMs}ms)`
  );
  restored++;
}

// 3. Restore posts.cover_filename if any placeholders remain
const postsRows = await c.query(
  "SELECT id, slug, cover_filename, created_at FROM posts WHERE cover_filename LIKE 'galleries/%' OR cover_filename LIKE '/uploads/%'"
);
console.log(`\nposts placeholders: ${postsRows.rows.length}`);
for (const p of postsRows.rows) {
  const ts = new Date(p.created_at).getTime();
  const match = closest(postBlobs, ts);
  if (!match) {
    unmatched.push({ table: "posts", id: p.id });
    continue;
  }
  await c.query("UPDATE posts SET cover_filename = $1 WHERE id = $2", [match.blob.url, p.id]);
  console.log(`  post ${p.id} (${p.slug}) -> ${match.blob.pathname}`);
  restored++;
}

await c.query("COMMIT");

console.log(`\n✓ Restored ${restored} rows.`);
if (unmatched.length) {
  console.log(`✗ Unmatched ${unmatched.length}:`);
  unmatched.forEach((u) => console.log(" ", u));
}

// 4. Sanity check
const remaining = await c.query(`
  SELECT
    (SELECT count(*)::int FROM page_content WHERE value LIKE '/uploads/galleries/%') AS pc_placeholders,
    (SELECT count(*)::int FROM page_content WHERE value LIKE 'http%blob.vercel-storage%') AS pc_blob,
    (SELECT count(*)::int FROM posts WHERE cover_filename LIKE 'http%blob.vercel-storage%') AS posts_blob,
    (SELECT count(*)::int FROM posts WHERE cover_filename LIKE '/uploads/%' OR cover_filename LIKE 'galleries/%') AS posts_placeholders
`);
console.log("\nApres restauration :");
console.log(remaining.rows[0]);

await c.end();
