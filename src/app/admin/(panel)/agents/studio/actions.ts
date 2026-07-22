"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  STUDIO_SETTINGS_FIELDS,
  updateSharedConfig,
  writeSharedKey,
} from "@/lib/studio-settings";

export async function resetTelegramOwnerAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await requireUser();
    // Efface la clé partagée ET tout override agent-specific résiduel
    // (whatsapp est le seul agent qui référence telegram_allowed_user_id).
    await writeSharedKey("telegram_allowed_user_id", "");
    const { execute } = await import("@/lib/db");
    await execute(
      `UPDATE agent_installations
         SET config = config - 'telegram_allowed_user_id', updated_at = NOW()
       WHERE slug = 'whatsapp'
         AND config ? 'telegram_allowed_user_id'`
    );
    revalidatePath("/admin/agents/studio");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveStudioSettingsAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const patch: Record<string, string> = {};
    for (const field of STUDIO_SETTINGS_FIELDS) {
      const raw = formData.get(field.key);
      // Toujours envoyer le champ même vide — vide = « supprime le partagé ».
      if (typeof raw === "string") patch[field.key] = raw;
    }
    await updateSharedConfig(patch);
    revalidatePath("/admin/agents/studio");
    revalidatePath("/admin/agents");
    // Chaque agent voit ses configs enrichies → on invalide leurs pages aussi.
    revalidatePath("/admin/agents/site");
    revalidatePath("/admin/agents/whatsapp");
    revalidatePath("/admin/agents/marketing");
    revalidatePath("/admin/agents/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
