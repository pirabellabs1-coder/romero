"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  AGENT_CATALOG,
  AgentSlug,
  addKnowledge,
  deleteKnowledge,
  effectivePrompt,
  getAgent,
  listKnowledge,
  logEvent,
  saveTestMessage,
  setAgentPrompt,
  setAgentStatus,
  updateAgentConfig,
  updateKnowledge,
} from "@/lib/agents";
import { SEED_KB } from "@/lib/agent-seed-kb";

function assertSlug(raw: string): AgentSlug {
  if (!(raw in AGENT_CATALOG)) throw new Error(`Agent inconnu : ${raw}`);
  return raw as AgentSlug;
}

function revalidateAgent(slug: AgentSlug) {
  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${slug}`);
}

// ─── Actions serveur ────────────────────────────────────────────────────
// Chaque action est protégée par requireUser() : la couche middleware
// bloque déjà l'accès à /admin/*, mais on double la protection ici pour
// que même un appel direct à l'action (POST) sans cookie soit refusé.

export async function installAgent(
  slug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    await setAgentStatus(s, "installed");
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function uninstallAgent(
  slug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    await setAgentStatus(s, "not_installed");
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function pauseAgent(
  slug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    await setAgentStatus(s, "paused");
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveAgentConfig(
  slug: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    const def = AGENT_CATALOG[s];
    const patch: Record<string, string> = {};
    for (const field of def.configFields) {
      const raw = formData.get(field.key);
      if (typeof raw === "string") patch[field.key] = raw.trim();
    }
    await updateAgentConfig(s, patch);
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Entraînement : prompt système ───────────────────────────────────
export async function saveAgentPrompt(
  slug: string,
  prompt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    if (prompt.length > 100_000) {
      return { ok: false, error: "Prompt trop long (max 100 000 caractères)" };
    }
    await setAgentPrompt(s, prompt);
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Base de connaissances ────────────────────────────────────────────
export async function addKnowledgeEntry(
  slug: string,
  entry: { title: string; content: string; category: string }
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    if (!entry.title.trim() || !entry.content.trim()) {
      return { ok: false, error: "Titre et contenu obligatoires" };
    }
    const id = await addKnowledge(s, entry);
    revalidateAgent(s);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateKnowledgeEntry(
  slug: string,
  id: number,
  patch: { title?: string; content?: string; category?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    await updateKnowledge(id, patch);
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteKnowledgeEntry(
  slug: string,
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    await deleteKnowledge(id);
    revalidateAgent(s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Seed KB : ajoute d'un coup toutes les fiches starter ─────────────
// Sécurité : ne re-crée pas ce qui existe déjà (dédup sur le titre).
// Le photographe peut relancer le seed à volonté sans dupliquer.
export async function seedKnowledgeAction(
  slug: string
): Promise<
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const s = assertSlug(slug);
    const seeds = SEED_KB[s];
    if (!seeds || seeds.length === 0)
      return { ok: false, error: "Pas de seed défini pour cet agent" };

    const existing = await listKnowledge(s);
    const existingTitles = new Set(existing.map((e) => e.title));

    let created = 0;
    let skipped = 0;
    for (const seed of seeds) {
      if (existingTitles.has(seed.title)) {
        skipped++;
        continue;
      }
      await addKnowledge(s, seed);
      created++;
    }
    await logEvent("site", "kb_seeded", { agent: s, created, skipped });
    revalidateAgent(s);
    return { ok: true, created, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Playground : envoi d'un message test à Claude ────────────────────
// Appelle l'API Anthropic avec le prompt effectif + la KB de l'agent, et
// renvoie la réponse. La conversation est sauvegardée dans agent_test_messages
// pour permettre au photographe de comparer les rendus avant/après un
// changement de prompt.
export async function runPlaygroundMessage(
  slug: string,
  input: string
): Promise<
  | { ok: true; output: string; duration_ms: number }
  | { ok: false; error: string }
> {
  const t0 = Date.now();
  try {
    await requireUser();
    const s = assertSlug(slug);
    if (!input.trim()) return { ok: false, error: "Message vide" };

    const inst = await getAgent(s);
    if (!inst) return { ok: false, error: "Agent introuvable en base" };

    const apiKey =
      typeof inst.config?.anthropic_api_key === "string"
        ? (inst.config.anthropic_api_key as string)
        : "";

    // Sans clé API on ne peut pas tester réellement — on renvoie une
    // simulation claire pour que l'UI reste utilisable. Le photographe
    // sait qu'il doit renseigner sa clé pour un vrai test.
    if (!apiKey) {
      const duration_ms = Date.now() - t0;
      const output =
        "⚠ Aucune clé API Anthropic renseignée dans l'onglet Configuration. " +
        "Ajoutez `anthropic_api_key` puis relancez pour tester avec Claude en réel.";
      await saveTestMessage({
        agent_slug: s,
        input_text: input,
        output_text: output,
        prompt_snapshot: effectivePrompt(inst),
        duration_ms,
        success: false,
        error_message: "missing_api_key",
      });
      return { ok: false, error: output };
    }

    const kb = await listKnowledge(s);
    const kbBlock = kb.length
      ? "\n\n## Base de connaissances\n" +
        kb
          .map((k) => `### ${k.title} (${k.category})\n${k.content}`)
          .join("\n\n")
      : "";

    const system = effectivePrompt(inst) + kbBlock;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: input }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      const duration_ms = Date.now() - t0;
      await saveTestMessage({
        agent_slug: s,
        input_text: input,
        output_text: "",
        prompt_snapshot: system,
        duration_ms,
        success: false,
        error_message: `HTTP ${resp.status} · ${text.slice(0, 200)}`,
      });
      await logEvent(s, "playground_error", { status: resp.status }, false);
      return { ok: false, error: `Anthropic ${resp.status} : ${text.slice(0, 200)}` };
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const output = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() || "(réponse vide)";
    const duration_ms = Date.now() - t0;

    await saveTestMessage({
      agent_slug: s,
      input_text: input,
      output_text: output,
      prompt_snapshot: system,
      duration_ms,
      success: true,
    });
    await logEvent(s, "playground_run", { duration_ms, chars: output.length });
    revalidatePath(`/admin/agents/${s}`);
    return { ok: true, output, duration_ms };
  } catch (e) {
    const duration_ms = Date.now() - t0;
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}
