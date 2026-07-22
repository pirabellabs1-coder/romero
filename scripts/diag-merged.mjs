import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const shared = new Map(
  (await c.query(`SELECT key,value FROM studio_settings`)).rows.map(r => [r.key, r.value])
);
const admin = (await c.query(`SELECT config FROM agent_installations WHERE slug='admin'`)).rows[0];
const agentCfg = admin?.config || {};

// Simule mergeConfigWithShared : shared d'abord, agent override sauf si vide
const merged = { ...Object.fromEntries(shared) };
for (const [k, v] of Object.entries(agentCfg)) {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) continue;
  merged[k] = v;
}

console.log("=== Merged config (ce que getAgent('admin') retournera) ===");
console.log("  public_phone       :", JSON.stringify(merged.public_phone));
console.log("  legal_name         :", JSON.stringify(merged.legal_name));
console.log("  legal_address      :", JSON.stringify(merged.legal_address));
console.log("  siret              :", JSON.stringify(merged.siret));
console.log("  notification_email :", JSON.stringify(merged.notification_email));
console.log("  anthropic_api_key  :", merged.anthropic_api_key ? "SET" : "MANQUE");
console.log("\nStatus admin agent :", admin ? "installed=false (mais row existe)" : "row absente");
await c.end();
