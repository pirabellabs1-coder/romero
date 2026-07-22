import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

console.log("=== ENV Vercel (clés critiques) ===");
const envs = [
  "OPENROUTER_API_KEY", "GROQ_API_KEY", "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET", "META_APP_ID", "META_APP_SECRET",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TELEGRAM_BOT_TOKEN",
  "MAIL_TO", "MAIL_FROM", "RESEND_API_KEY",
];
for (const k of envs) {
  const v = process.env[k];
  const status = v ? "✓ SET" : "✗ MANQUE";
  const preview = v ? v.slice(0, 20) + "..." : "";
  console.log(`  ${status.padEnd(10)} ${k.padEnd(28)} ${preview}`);
}

console.log("\n=== studio_settings (Studio complet ?) ===");
const need = ["siret", "legal_name", "legal_address", "public_phone",
              "notification_email", "google_refresh_token",
              "instagram_business_id", "instagram_access_token",
              "meta_access_token", "telegram_bot_token", "telegram_allowed_user_id"];
const r = await c.query(`SELECT key, value FROM studio_settings`);
const map = new Map(r.rows.map(x => [x.key, x.value]));
for (const k of need) {
  const v = map.get(k);
  const status = v ? "✓" : "✗";
  const preview = v ? v.slice(0, 40) + (v.length > 40 ? "..." : "") : "MANQUE";
  console.log(`  ${status} ${k.padEnd(28)} ${preview}`);
}

console.log("\n=== agent_installations statut ===");
const a = await c.query(`SELECT slug, status, jsonb_object_keys(config) as k FROM agent_installations`);
const grouped = new Map();
for (const row of a.rows) {
  if (!grouped.has(row.slug)) grouped.set(row.slug, { status: row.status, keys: [] });
  grouped.get(row.slug).keys.push(row.k);
}
for (const [slug, info] of grouped) {
  console.log(`  ${slug.padEnd(12)} ${info.status.padEnd(12)} ${info.keys.length} clés config`);
}

console.log("\n=== Derniers events par agent ===");
const ev = await c.query(`
  SELECT agent_slug, event_type, success, created_at
  FROM agent_events
  ORDER BY created_at DESC LIMIT 15
`);
for (const row of ev.rows) {
  const flag = row.success ? "✓" : "✗";
  console.log(`  ${flag} ${row.agent_slug.padEnd(12)} ${row.event_type.padEnd(30)} ${row.created_at.toISOString().slice(0, 16)}`);
}
await c.end();
