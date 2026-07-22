import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const rows = await c.query(`SELECT slug, name, status, jsonb_pretty(config) as cfg FROM agent_installations WHERE slug='admin'`);
if (rows.rows.length === 0) {
  console.log("!!! agent_installations n'a PAS de row admin — CRITIQUE");
} else {
  console.log("=== admin agent (installations) ===");
  console.log("  slug   :", rows.rows[0].slug);
  console.log("  status :", rows.rows[0].status);
  console.log("  config :\n" + rows.rows[0].cfg);
}
await c.end();
