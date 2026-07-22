import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(`SELECT value FROM page_content WHERE page='home' AND key='hero_photo' LIMIT 1`);
console.log(r.rows[0]?.value ?? "(none)");
await c.end();
