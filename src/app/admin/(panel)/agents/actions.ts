"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  AGENT_CATALOG,
  AgentSlug,
  setAgentStatus,
  updateAgentConfig,
} from "@/lib/agents";

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
