// One-shot data migration: SQLite (current Blob snapshot) → Supabase Postgres.
// Run via: node supabase/migrate-data.js
//
// Strategy:
// 1. Wipe target tables in dependency-safe order (photos → galleries first).
// 2. Insert galleries with cover_photo_id = NULL.
// 3. Insert photos (which reference gallery_id).
// 4. UPDATE galleries to restore the cover_photo_id values.
// 5. Insert posts/reviews/messages/settings/users.
// 6. Reset each sequence to MAX(id) + 1 so future INSERTs don't collide.

const Database = require("better-sqlite3");
const { Client } = require("pg");
const path = require("path");

const SQLITE_PATH = process.argv[2] || "/tmp/current_blob.db";
const PG_URL = {
  host: "aws-1-eu-north-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.igzotmjfvbfnzxstdvpm",
  password: "6RHhC82aa#857mE",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
};

const TABLES_IN_ORDER = ["users", "settings", "messages", "reviews", "posts"];
// galleries + photos handled separately because of the cover_photo_id cycle.

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Client(PG_URL);
  await pg.connect();
  console.log("Connected to Postgres.");

  // Wipe target tables (idempotency)
  console.log("\nWiping target tables…");
  await pg.query("BEGIN");
  // Order matters because of FK constraints
  await pg.query("UPDATE galleries SET cover_photo_id = NULL"); // break the FK cycle
  for (const t of ["photos", "galleries", ...TABLES_IN_ORDER]) {
    await pg.query(`DELETE FROM public.${t}`);
    console.log(`  wiped ${t}`);
  }
  await pg.query("COMMIT");

  // --- galleries (without cover_photo_id) ---
  const galleries = sqlite.prepare("SELECT * FROM galleries ORDER BY id").all();
  for (const g of galleries) {
    await pg.query(
      `INSERT INTO public.galleries
         (id, slug, names, place, date_label, region, kind, intro_fr, intro_en,
          cover_photo_id, featured, sort_order, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12)`,
      [
        g.id, g.slug, g.names, g.place, g.date_label || "",
        g.region, g.kind, g.intro_fr || "", g.intro_en || "",
        g.featured, g.sort_order, g.published,
      ]
    );
  }
  console.log(`Inserted ${galleries.length} galleries.`);

  // --- photos ---
  const photos = sqlite.prepare("SELECT * FROM photos ORDER BY id").all();
  for (const p of photos) {
    await pg.query(
      `INSERT INTO public.photos
         (id, gallery_id, filename, alt, span, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.id, p.gallery_id, p.filename, p.alt || "", p.span || "", p.sort_order]
    );
  }
  console.log(`Inserted ${photos.length} photos.`);

  // --- restore cover_photo_id on galleries ---
  for (const g of galleries) {
    if (g.cover_photo_id != null) {
      await pg.query(
        "UPDATE public.galleries SET cover_photo_id = $1 WHERE id = $2",
        [g.cover_photo_id, g.id]
      );
    }
  }
  console.log("Restored cover_photo_id on galleries.");

  // --- users ---
  const users = sqlite.prepare("SELECT * FROM users").all();
  for (const u of users) {
    await pg.query(
      "INSERT INTO public.users (id, email, password_hash) VALUES ($1, $2, $3)",
      [u.id, u.email, u.password_hash]
    );
  }
  console.log(`Inserted ${users.length} users.`);

  // --- settings ---
  const settings = sqlite.prepare("SELECT * FROM settings").all();
  for (const s of settings) {
    await pg.query(
      "INSERT INTO public.settings (key, value) VALUES ($1, $2)",
      [s.key, s.value]
    );
  }
  console.log(`Inserted ${settings.length} settings.`);

  // --- posts ---
  const posts = sqlite.prepare("SELECT * FROM posts ORDER BY id").all();
  for (const p of posts) {
    await pg.query(
      `INSERT INTO public.posts
         (id, slug, title_fr, title_en, category, excerpt_fr, excerpt_en,
          body_fr, body_en, cover_filename, published_at, read_minutes,
          published, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        p.id, p.slug, p.title_fr, p.title_en || "", p.category,
        p.excerpt_fr || "", p.excerpt_en || "", p.body_fr || "", p.body_en || "",
        p.cover_filename, p.published_at, p.read_minutes,
        p.published, p.sort_order,
      ]
    );
  }
  console.log(`Inserted ${posts.length} posts.`);

  // --- reviews ---
  const reviews = sqlite.prepare("SELECT * FROM reviews ORDER BY id").all();
  for (const r of reviews) {
    await pg.query(
      `INSERT INTO public.reviews
         (id, name, date_label, rating, text_fr, text_en, sort_order, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [r.id, r.name, r.date_label, r.rating, r.text_fr, r.text_en || "", r.sort_order, r.published]
    );
  }
  console.log(`Inserted ${reviews.length} reviews.`);

  // --- messages ---
  const messages = sqlite.prepare("SELECT * FROM messages ORDER BY id").all();
  for (const m of messages) {
    await pg.query(
      `INSERT INTO public.messages
         (id, first_name, last_name, email, phone, wedding_date, place,
          message, lang, read_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()))`,
      [
        m.id, m.first_name, m.last_name, m.email, m.phone || "",
        m.wedding_date || "", m.place || "", m.message, m.lang || "fr",
        m.read_at || null, m.created_at || null,
      ]
    );
  }
  console.log(`Inserted ${messages.length} messages.`);

  // --- Reset sequences ---
  console.log("\nResetting sequences…");
  for (const t of ["users", "galleries", "photos", "posts", "reviews", "messages"]) {
    await pg.query(
      `SELECT setval(pg_get_serial_sequence('public.${t}', 'id'),
                     COALESCE((SELECT MAX(id) FROM public.${t}), 1),
                     (SELECT MAX(id) FROM public.${t}) IS NOT NULL)`
    );
    console.log(`  reset ${t}`);
  }

  // --- Final verification ---
  console.log("\n── Final counts in Postgres ──");
  for (const t of ["users", "settings", "galleries", "photos", "posts", "reviews", "messages"]) {
    const r = await pg.query(`SELECT COUNT(*) as c FROM public.${t}`);
    console.log(`  ${t.padEnd(12)} ${r.rows[0].c}`);
  }

  await pg.end();
  sqlite.close();
  console.log("\n✅ Migration complete.");
}

main().catch((e) => {
  console.error("\n❌ Migration failed:", e);
  process.exit(1);
});
