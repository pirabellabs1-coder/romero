"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createSection,
  updateSectionData,
  deleteSection,
  swapSectionPositions,
  setSectionSlot,
  listSectionsForPage,
  listSectionsForSlot,
  type SectionType,
  type SectionSlot,
  type SectionData,
} from "@/lib/page-sections";

function revalidateHome() {
  revalidatePath("/");
  revalidatePath("/admin/content/home");
}

export async function addSectionAction(
  page: string,
  type: SectionType,
  slot: SectionSlot = "bottom"
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    requireUser();
    const defaultData: Record<SectionType, SectionData> = {
      "text":        { eyebrow_fr: "SECTION", title_fr: "Nouveau titre", body_fr: "Texte de la nouvelle section.", align: "center", background: "cream" },
      "text-image":  { image_position: "right", title_fr: "Nouvelle section", body_fr: "Texte à droite ou gauche d'une photo.", image_focal: "center center" },
      "quote":       { quote_fr: "Une citation à compléter.", author: "— Auteur" },
      "full-image":  { image_focal: "center center", caption_fr: "Légende optionnelle." },
    };
    const id = await createSection(page, type, slot, defaultData[type]);
    revalidateHome();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Move a section to a different slot (appended at the end of that slot). */
export async function changeSectionSlotAction(
  id: number,
  slot: SectionSlot
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    await setSectionSlot(id, slot);
    revalidateHome();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateSectionAction(
  id: number,
  data: SectionData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    await updateSectionData(id, data);
    revalidateHome();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSectionAction(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    await deleteSection(id);
    revalidateHome();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function moveSectionAction(
  page: string,
  id: number,
  direction: "up" | "down"
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    // Move only within the same slot — moving between slots happens via
    // changeSectionSlotAction.
    const all = await listSectionsForPage(page);
    const self = all.find((s) => s.id === id);
    if (!self) return { ok: false, error: "Section introuvable" };
    const sameSlot = await listSectionsForSlot(page, self.slot);
    const idx = sameSlot.findIndex((s) => s.id === id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sameSlot.length) return { ok: true };
    await swapSectionPositions(sameSlot[idx].id, sameSlot[targetIdx].id);
    revalidateHome();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
