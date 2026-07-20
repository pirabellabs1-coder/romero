"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateSharedConfig } from "@/lib/studio-settings";

const COMPANY_KEYS = ["siret", "legal_name", "legal_status", "legal_address", "rcs_city"] as const;
const CONTACT_KEYS = ["notification_email", "public_phone"] as const;

function pick(fd: FormData, keys: readonly string[]): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const k of keys) {
    const v = fd.get(k);
    if (typeof v === "string") patch[k] = v;
  }
  return patch;
}

export async function saveOnboardingCompanyAction(
  fd: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await updateSharedConfig(pick(fd, COMPANY_KEYS));
    revalidatePath("/admin/onboarding");
    revalidatePath("/admin/agents");
    revalidatePath("/admin/agents/studio");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveOnboardingContactAction(
  fd: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await updateSharedConfig(pick(fd, CONTACT_KEYS));
    revalidatePath("/admin/onboarding");
    revalidatePath("/admin/agents");
    revalidatePath("/admin/agents/studio");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
