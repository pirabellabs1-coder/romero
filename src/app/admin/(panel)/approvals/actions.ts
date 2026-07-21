"use server";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { handleApprovalCallback } from "@/lib/approval-flow";

/**
 * Approbation / rejet manuel depuis l'admin (si Telegram n'a pas
 * fonctionné ou si Mickael préfère l'UI web).
 */
export async function manualApprovalAction(
  approvalId: number,
  action: "approve" | "reject"
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const res = await handleApprovalCallback({
      callbackData: `act:${approvalId}:${action}`,
    });
    if (!res.ok) return { ok: false, error: res.error ?? "?" };
    revalidatePath("/admin/approvals");
    revalidatePath("/admin/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}
