/**
 * GET /api/admin/seed-all-kbs
 * ──────────────────────────────────────────────────────────────
 * One-shot : importe le pack de démarrage (KB seed) pour les 4
 * agents en un seul appel. Protégé par Bearer CRON_SECRET.
 * Idempotent — si une fiche existe déjà (même titre), elle est
 * ignorée. Endpoint destiné à être supprimé après le premier
 * peuplement de production.
 */
import { NextRequest, NextResponse } from "next/server";
import { AGENT_ORDER, addKnowledge, listKnowledge, setAgentPrompt, getAgent } from "@/lib/agents";
import { SEED_KB } from "@/lib/agent-seed-kb";
import { DEFAULT_PROMPTS } from "@/lib/agent-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const results: Record<
    string,
    { kb_created: number; kb_skipped: number; prompt_pushed: boolean }
  > = {};

  for (const slug of AGENT_ORDER) {
    // ── 1. KB seed
    const existing = await listKnowledge(slug).catch(() => []);
    const existingTitles = new Set(existing.map((e) => e.title));
    let kb_created = 0;
    let kb_skipped = 0;
    for (const entry of SEED_KB[slug] || []) {
      if (existingTitles.has(entry.title)) {
        kb_skipped++;
        continue;
      }
      await addKnowledge(slug, entry);
      kb_created++;
    }

    // ── 2. Prompt système : push DEFAULT_PROMPTS[slug] en base si le
    // champ system_prompt est vide (jamais écraser un prompt custom
    // que Mickael aurait édité).
    let prompt_pushed = false;
    const inst = await getAgent(slug).catch(() => null);
    if (inst && (!inst.system_prompt || inst.system_prompt.trim().length === 0)) {
      const promptContent = DEFAULT_PROMPTS[slug];
      if (promptContent) {
        await setAgentPrompt(slug, promptContent);
        prompt_pushed = true;
      }
    }

    results[slug] = { kb_created, kb_skipped, prompt_pushed };
  }

  return NextResponse.json({ ok: true, results, ran_at: new Date().toISOString() });
}
