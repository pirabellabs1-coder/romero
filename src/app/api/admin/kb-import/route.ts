/**
 * POST /api/admin/kb-import
 * ──────────────────────────────────────────────────────────────
 * Réinjecte un export JSON (format sortie de /api/admin/kb-export).
 * Idempotent — les fiches déjà présentes (même titre) sont skippées.
 * Le prompt système est mis à jour uniquement si le fichier en contient un.
 * Protégé par la session admin (requireUser).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  AGENT_ORDER,
  addKnowledge,
  listKnowledge,
  setAgentPrompt,
  type AgentSlug,
} from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportPayload = {
  agent_slug?: string;
  system_prompt?: string;
  knowledge?: Array<{
    title?: string;
    category?: string;
    content?: string;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ImportPayload | null;
  if (!body || typeof body !== "object")
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });

  const slug = body.agent_slug as AgentSlug | undefined;
  if (!slug || !AGENT_ORDER.includes(slug))
    return NextResponse.json({ ok: false, error: "invalid slug" }, { status: 400 });

  // Prompt
  let prompt_updated = false;
  if (typeof body.system_prompt === "string" && body.system_prompt.trim().length > 0) {
    await setAgentPrompt(slug, body.system_prompt);
    prompt_updated = true;
  }

  // KB : dédup par titre (case-insensitive)
  const existing = await listKnowledge(slug);
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()));

  let created = 0;
  let skipped = 0;
  const entries = Array.isArray(body.knowledge) ? body.knowledge : [];
  for (const entry of entries) {
    const title = String(entry.title ?? "").trim();
    const content = String(entry.content ?? "").trim();
    const category = String(entry.category ?? "general").trim() || "general";
    if (!title || !content) {
      skipped++;
      continue;
    }
    if (existingTitles.has(title.toLowerCase())) {
      skipped++;
      continue;
    }
    await addKnowledge(slug, { title, content, category });
    created++;
  }

  return NextResponse.json({
    ok: true,
    slug,
    prompt_updated,
    kb_created: created,
    kb_skipped: skipped,
    kb_scanned: entries.length,
  });
}
