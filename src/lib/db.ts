import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { tryRestoreDbFromBlob, getBlobDbLastModifiedMs } from "@/lib/db-persist";

// On Vercel/Lambda the deployment bundle (process.cwd()) is read-only.
// Detect that, copy the seed DB to /tmp (the only writable area) on first use.
const IS_SERVERLESS = !!process.env.VERCEL || process.env.NEXT_RUNTIME === "edge";
const SOURCE_DB = path.join(process.cwd(), "data", "romero.db");
const RUNTIME_DB_DIR = IS_SERVERLESS ? "/tmp/romero-data" : path.join(process.cwd(), "data");
const RUNTIME_DB = path.join(RUNTIME_DB_DIR, "romero.db");

function ensureWritableDb(): string {
  if (!IS_SERVERLESS) {
    if (!fs.existsSync(RUNTIME_DB_DIR)) fs.mkdirSync(RUNTIME_DB_DIR, { recursive: true });
    return RUNTIME_DB;
  }
  // serverless: copy seed DB into /tmp once per cold start
  if (!fs.existsSync(RUNTIME_DB_DIR)) fs.mkdirSync(RUNTIME_DB_DIR, { recursive: true });
  if (!fs.existsSync(RUNTIME_DB)) {
    if (fs.existsSync(SOURCE_DB)) {
      fs.copyFileSync(SOURCE_DB, RUNTIME_DB);
    }
    // else: empty file, migrate() will create tables and seedIfEmpty() will populate
  }
  return RUNTIME_DB;
}

let _db: Database.Database | null = null;
// Timestamp of the Blob snapshot currently loaded into _db. Used to
// detect when another lambda has pushed a newer snapshot — at which
// point this lambda re-downloads. Initial value 0 means "we have no
// idea what's in Blob yet, treat as stale".
let _dbLoadedBlobTs = 0;
// How often we poll Blob's HEAD to check for staleness. 10 seconds
// trades cost (1 HEAD request per request, batched within window) for
// freshness (changes propagate within 10s across lambdas).
let _lastFreshnessCheck = 0;
const FRESHNESS_CHECK_INTERVAL_MS = 10_000;

/**
 * Async getter that handles three serverless edge cases:
 *
 * 1. Cold start: /tmp DB is empty → download from Blob, fall back to
 *    bundled seed if Blob is also empty.
 * 2. Another lambda has pushed a newer snapshot → re-download Blob so
 *    public pages don't serve stale data after the photographer edits
 *    from /admin on a different lambda.
 * 3. Warm and fresh: return cached handle, no Blob fetch.
 *
 * Public page handlers AND admin server actions should both use this.
 */
export async function getDbAsync(): Promise<Database.Database> {
  if (!IS_SERVERLESS) return getDb();

  if (!fs.existsSync(RUNTIME_DB_DIR)) fs.mkdirSync(RUNTIME_DB_DIR, { recursive: true });

  // Cold start: no DB handle yet, restore from Blob (or seed if Blob empty).
  if (!_db) {
    const restored = await tryRestoreDbFromBlob(RUNTIME_DB);
    if (!restored && !fs.existsSync(RUNTIME_DB) && fs.existsSync(SOURCE_DB)) {
      fs.copyFileSync(SOURCE_DB, RUNTIME_DB);
    }
    const blobTs = await getBlobDbLastModifiedMs();
    _dbLoadedBlobTs = blobTs ?? Date.now();
    _lastFreshnessCheck = Date.now();
    return getDb();
  }

  // Warm path: periodic check that our cached DB is still the latest.
  const now = Date.now();
  if (now - _lastFreshnessCheck >= FRESHNESS_CHECK_INTERVAL_MS) {
    _lastFreshnessCheck = now;
    const blobTs = await getBlobDbLastModifiedMs();
    if (blobTs && blobTs > _dbLoadedBlobTs) {
      // Another lambda pushed a newer snapshot — re-download.
      try { _db.close(); } catch {}
      _db = null;
      const restored = await tryRestoreDbFromBlob(RUNTIME_DB);
      if (restored) _dbLoadedBlobTs = blobTs;
      // Drop the in-memory settings cache too — otherwise a freshly
      // downloaded DB with new settings would still serve stale data
      // for up to 15s. Avoids circular import via dynamic require.
      try {
        const { invalidateSettingsCache } = await import("@/lib/settings");
        invalidateSettingsCache();
      } catch {}
      return getDb();
    }
  }

  return _db;
}

/**
 * Called by db-persist.ts after a successful Blob upload to mark our
 * cached `_db` handle as "up to date with Blob as of timestamp X".
 * Without this, the next freshness check on this lambda would see
 * Blob's new uploadedAt > _dbLoadedBlobTs and re-download — potentially
 * pulling a stale CDN copy that overwrites the local change we just made.
 *
 * Also bumps _lastFreshnessCheck so the very next read on this lambda
 * skips the HEAD round-trip entirely (we already know we're current).
 */
export function markDbSyncedAt(uploadedAtMs: number): void {
  _dbLoadedBlobTs = Math.max(_dbLoadedBlobTs, uploadedAtMs);
  _lastFreshnessCheck = Date.now();
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = ensureWritableDb();
  const db = new Database(dbPath);
  // Use DELETE journal mode (rollback journal) to keep all data in the single .db file.
  // WAL would create separate -wal/-shm files that don't get committed to git nor packaged
  // by Vercel's file tracing, which silently strips fresh data from the deployed DB.
  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedIfEmpty(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS galleries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      names TEXT NOT NULL,
      place TEXT NOT NULL,
      date_label TEXT NOT NULL,
      region TEXT NOT NULL,
      kind TEXT NOT NULL,
      intro_fr TEXT NOT NULL DEFAULT '',
      intro_en TEXT NOT NULL DEFAULT '',
      cover_photo_id INTEGER,
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gallery_id INTEGER REFERENCES galleries(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      alt TEXT DEFAULT '',
      span TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title_fr TEXT NOT NULL,
      title_en TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      excerpt_fr TEXT NOT NULL DEFAULT '',
      excerpt_en TEXT NOT NULL DEFAULT '',
      body_fr TEXT NOT NULL DEFAULT '',
      body_en TEXT NOT NULL DEFAULT '',
      cover_filename TEXT,
      published_at TEXT NOT NULL,
      read_minutes INTEGER NOT NULL DEFAULT 5,
      published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date_label TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      text_fr TEXT NOT NULL,
      text_en TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      wedding_date TEXT DEFAULT '',
      place TEXT DEFAULT '',
      message TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'fr',
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedIfEmpty(db: Database.Database) {
  const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync("admin", 10);
    db.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)").run("admin@romero.local", hash);
  }

  const defaults: Record<string, string> = {
    contact_city: "Nice, Côte d'Azur",
    contact_phone: "06 04 03 70 76",
    contact_email: "romerophotography.contact@gmail.com",
    instagram_handle: "@romeromomentsphoto",
    instagram_url: "https://www.instagram.com/romeromomentsphoto",
    google_reviews_url: "https://www.google.com/maps/search/?api=1&query=Romero+Photography+Nice",
    accent: "#B8975A",
    background: "cream",
    foreground: "forest",
    sage_tone: "sage",
    display_font: "Cormorant Garamond",
    body_font: "Inter",
    image_treatment: "natural",
    italic_titles: "1",
    watercolor: "1",
    ornaments: "regular",
    section_density: "regular",
    image_radius: "4",
    caps_tracking: "32",
    font_scale: "100",
    monogram_style: "framed",
    header_style: "transparent",
    button_style: "sage",
  };
  const ins = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);

  // ── One-shot upgrade: replace the legacy generic Google Maps search URL with
  // the real share.google link the photographer provided. Idempotent — only
  // triggers on rows still holding the old placeholder value.
  db.prepare(
    "UPDATE settings SET value = ? WHERE key = 'google_reviews_url' AND value = ?"
  ).run(
    "https://share.google/ckAXNbRvvnfKv1o1T",
    "https://www.google.com/maps/search/?api=1&query=Romero+Photography+Nice"
  );

  // ── One-shot upgrade: portfolio filter taxonomy moved from
  // INTIMISTE/INTERNATIONAL to MARIAGE/ENGAGEMENT/PORTRAIT/LIFESTYLE.
  // Map all existing legacy kinds to MARIAGE (all current galleries are weddings).
  db.prepare(
    "UPDATE galleries SET kind = 'MARIAGE' WHERE kind IN ('INTIMISTE', 'INTERNATIONAL')"
  ).run();
  // Remove the legacy Léa & Thomas placeholder gallery (no real photos).
  db.prepare("DELETE FROM photos WHERE gallery_id IN (SELECT id FROM galleries WHERE slug = 'lea-thomas')").run();
  db.prepare("DELETE FROM galleries WHERE slug = 'lea-thomas'").run();

  const galleryCount = (db.prepare("SELECT COUNT(*) as c FROM galleries").get() as { c: number }).c;
  if (galleryCount === 0) {
    const insGal = db.prepare(`
      INSERT OR IGNORE INTO galleries (slug, names, place, date_label, region, kind, intro_fr, intro_en, featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seedGals: Array<[string, string, string, string, string, string, string, string, number, number]> = [
      ["anastasia-jordan", "Anastasia & Jordan", "Èze, France", "Septembre 2025", "FRANCE", "MARIAGE",
        "Un mariage suspendu au-dessus de la Méditerranée. Anastasia portait un voile que le mistral n'arrêtait pas de soulever — et Jordan, lui, ne regardait qu'elle. La cérémonie laïque s'est tenue au coucher du soleil, dans le jardin d'une villa privée taillée dans la pierre claire d'Èze.",
        "A wedding suspended above the Mediterranean. Anastasia wore a veil the mistral kept lifting — and Jordan only had eyes for her. The civil ceremony took place at sunset, in the garden of a private villa carved into the pale stone of Èze.",
        1, 0],
      ["manon-kevin", "Manon & Kevin", "Saint-Paul-de-Vence", "Juin 2025", "FRANCE", "MARIAGE",
        "Un mariage en petit comité dans les ruelles ocres de Saint-Paul. Cinquante invités, des tables longues sous les tilleuls, et une mariée qui a dansé pieds nus jusqu'au dernier morceau.",
        "An intimate wedding in the ochre alleys of Saint-Paul. Fifty guests, long tables under the lime trees, and a bride who danced barefoot till the last song.",
        1, 1],
      ["sonia-sebastien", "Sonia & Sébastien", "Cap Ferrat", "Mai 2025", "FRANCE", "MARIAGE",
        "Cap Ferrat, un matin de mai. La mer plate comme une plaque d'argent, un déjeuner sur la terrasse d'une villa Belle Époque, et le rire de Sonia qui résonnait jusqu'aux pins.",
        "Cap Ferrat, a May morning. The sea flat as a silver plate, lunch on the terrace of a Belle Époque villa, and Sonia's laughter echoing all the way to the pines.",
        1, 2],
      ["sandy-alain", "Sandy & Alain", "Marrakech, Maroc", "Octobre 2024", "INTERNATIONAL", "MARIAGE",
        "Quatre jours de fête dans un riad de la palmeraie. Lanternes en cuivre, tapis berbères, henné dansé jusqu'à l'aube — un mariage chaleureux et joyeusement bruyant.",
        "Four days of celebration in a riad in the palm grove. Copper lanterns, Berber rugs, henna danced till dawn — a warm, joyfully loud wedding.",
        0, 3],
      ["victoria-patrick", "Victoria & Patrick", "Lac de Côme, Italie", "Juillet 2024", "INTERNATIONAL", "MARIAGE",
        "Une cérémonie sur le ponton d'une villa du XVIIIᵉ siècle, et un dîner à la lueur de centaines de bougies. Victoria portait la robe de sa grand-mère, restaurée fil à fil.",
        "A ceremony on the jetty of an 18th-century villa, and a dinner lit by hundreds of candles. Victoria wore her grandmother's gown, restored thread by thread.",
        0, 4],
    ];
    const insPhoto = db.prepare("INSERT INTO photos (gallery_id, filename, alt, span, sort_order) VALUES (?, ?, ?, ?, ?)");
    const setCover = db.prepare("UPDATE galleries SET cover_photo_id = ? WHERE id = ?");
    for (const g of seedGals) {
      const r = insGal.run(...g);
      const id = Number(r.lastInsertRowid);
      // Seed every demo gallery with the hero photo as its cover, so the
      // portfolio + homepage look populated until the user uploads real photos.
      const span = g[0] === "anastasia-jordan" ? "big" : "";
      const ph = insPhoto.run(id, "hero.jpg", g[1], span, 0);
      setCover.run(Number(ph.lastInsertRowid), id);
    }
  }

  const postCount = (db.prepare("SELECT COUNT(*) as c FROM posts").get() as { c: number }).c;
  if (postCount === 0) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO posts (slug, title_fr, title_en, category, excerpt_fr, excerpt_en, body_fr, body_en, published_at, read_minutes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const posts: Array<[string, string, string, string, string, string, string, string, string, number, number]> = [
      ["5-lieux-secrets-cote-azur", "5 lieux secrets pour se marier sur la Côte d'Azur", "5 secret venues to marry on the French Riviera", "LIEUX",
        "Au-delà des classiques, voici cinq adresses confidentielles pour un mariage hors du temps — d'une chapelle perchée dans l'arrière-pays niçois aux jardins privés du Cap d'Antibes.",
        "Beyond the classics, five confidential addresses for a timeless wedding — from a chapel perched in the Nice hinterland to the private gardens of Cap d'Antibes.",
        "", "", "2026-04-12", 6, 0],
      ["anastasia-jordan-eze", "Anastasia & Jordan — un mariage à Èze", "Anastasia & Jordan — a wedding in Èze", "MARIAGES",
        "Retour sur une journée suspendue entre ciel et Méditerranée. Le mistral, le voile, le coucher de soleil — toute l'histoire en 60 images.",
        "A day suspended between sky and Mediterranean. The mistral, the veil, the sunset — the whole story in 60 images.",
        "", "", "2026-03-28", 8, 1],
      ["choisir-photographe-mariage", "Comment choisir son photographe de mariage", "How to choose your wedding photographer", "CONSEILS",
        "Style, prix, feeling, livrables : le guide honnête pour ne pas se tromper, écrit par un photographe qui a vu beaucoup d'erreurs (et quelques merveilles).",
        "Style, price, vibe, deliverables: the honest guide to not getting it wrong, written by a photographer who's seen many mistakes (and a few marvels).",
        "", "", "2026-03-15", 5, 2],
      ["heure-doree", "L'heure dorée : pourquoi tout le monde en parle", "Golden hour: why everyone is talking about it", "CONSEILS",
        "Cette lumière qui tombe une heure avant le coucher du soleil — comment la prévoir, comment l'attendre, et comment ne pas la rater.",
        "That light that falls an hour before sunset — how to predict it, how to wait for it, and how not to miss it.",
        "", "", "2026-03-02", 4, 3],
      ["manon-kevin-saint-paul", "Manon & Kevin — Saint-Paul, intime", "Manon & Kevin — Saint-Paul, intimate", "MARIAGES",
        "Un mariage à cinquante invités dans les ruelles de Saint-Paul-de-Vence. Tables longues, tilleuls, mariée pieds nus.",
        "A fifty-guest wedding in the alleys of Saint-Paul-de-Vence. Long tables, lime trees, barefoot bride.",
        "", "", "2026-02-20", 7, 4],
      ["domaine-de-la-tour", "Domaine de la Tour : visite guidée", "Domaine de la Tour: guided tour", "LIEUX",
        "Trois hectares, deux oliveraies, une chapelle XVIIᵉ. Un repérage en images d'un domaine qui mérite votre attention.",
        "Three hectares, two olive groves, a 17th-century chapel. A photo tour of an estate that deserves your attention.",
        "", "", "2026-02-08", 5, 5],
    ];
    for (const p of posts) ins.run(...p);
  }

  const reviewCount = (db.prepare("SELECT COUNT(*) as c FROM reviews").get() as { c: number }).c;
  if (reviewCount === 0) {
    const ins = db.prepare("INSERT INTO reviews (name, date_label, rating, text_fr, text_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
    const reviews: Array<[string, string, number, string, string, number]> = [
      ["Anastasia & Jordan", "il y a 2 mois", 5,
        "Mickael a transformé notre journée en un véritable poème visuel. Discret, attentionné, doué d'un œil rare — il a saisi des regards, des frissons, des fous rires que nous n'avions même pas remarqués sur le moment. Trois mois après, nous regardons encore les photos chaque dimanche.",
        "Mickael turned our day into a true visual poem. Discreet, attentive, gifted with a rare eye — he caught glances, shivers, laughter we hadn't even noticed at the time. Three months later, we still look at the photos every Sunday.",
        0],
      ["Manon C.", "il y a 4 mois", 5,
        "Nous cherchions un photographe sensible, capable de raconter une histoire plutôt que de cocher des cases. Mickael est cela, et bien plus. Sa galerie est devenue notre bien le plus précieux.",
        "We were looking for a sensitive photographer who could tell a story rather than tick boxes. Mickael is that, and much more. His gallery has become our most precious belonging.",
        1],
      ["Sonia & Sébastien", "il y a 6 mois", 5,
        "Une rencontre humaine avant tout. Mickael nous a mis à l'aise dès le premier appel, et le jour J il s'est presque fait oublier. Le résultat est lumineux, élégant, profondément vrai.",
        "A human encounter above all. Mickael put us at ease from the first call, and on the day he was almost invisible. The result is luminous, elegant, deeply true.",
        2],
      ["Sandy R.", "il y a 8 mois", 5,
        "Nous l'avons emmené avec nous au Maroc pour quatre jours de fête. Il a tout suivi, tout capté, sans jamais peser. Et il a su rendre chaque détail — du henné aux lanternes — avec une délicatesse infinie.",
        "We took him with us to Morocco for four days of celebration. He followed everything, captured everything, never imposing. And he rendered every detail — from henna to lanterns — with infinite delicacy.",
        3],
      ["Victoria P.", "il y a 10 mois", 5,
        "Mickael a une qualité rare : il rend ses sujets à eux-mêmes. Sur ses photos, je nous reconnais — pas une version idéalisée, nous, simplement, avec notre lumière du jour.",
        "Mickael has a rare quality: he returns his subjects to themselves. In his photos, I recognise us — not an idealised version, just us, with our own daylight.",
        4],
      ["Léa & Thomas", "il y a 1 an", 5,
        "Une livraison rapide, des images sublimes, et un accompagnement de bout en bout. Nous le recommandons les yeux fermés à tous nos amis qui se marient.",
        "Fast delivery, stunning images, and end-to-end support. We recommend him with our eyes closed to all our friends getting married.",
        5],
    ];
    for (const r of reviews) ins.run(...r);
  }
}
