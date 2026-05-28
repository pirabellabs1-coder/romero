"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createSection,
  updateSectionData,
  deleteSection,
  swapSectionPositions,
  listSectionsForPage,
  type SectionType,
  type SectionData,
} from "@/lib/page-sections";

function revalidateHome() {
  revalidatePath("/");
  revalidatePath("/admin/content/home");
}

export async function addSectionAction(
  page: string,
  type: SectionType
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    requireUser();
    // Sensible empty defaults so the new section is immediately visible
    // and clearly screams "edit me" rather than sitting blank.
    const defaultData: Record<SectionType, SectionData> = {
      "text":        { eyebrow_fr: "SECTION", title_fr: "Nouveau titre", body_fr: "Texte de la nouvelle section.", align: "center", background: "cream" },
      "text-image":  { image_position: "right", title_fr: "Nouvelle section", body_fr: "Texte à droite ou gauche d'une photo.", image_focal: "center center" },
      "quote":       { quote_fr: "Une citation à compléter.", author: "— Auteur" },
      "full-image":  { image_focal: "center center", caption_fr: "Légende optionnelle." },
    };
    const id = await createSection(page, type, defaultData[type]);
    revalidateHome();
    return { ok: true, id };
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
    const all = await listSectionsForPage(page);
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return { ok: false, error: "Section introuvable" };
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= all.length) return { ok: true }; // no-op at edges
    await swapSectionPositions(all[idx].id, all[targetIdx].id);
    revalidateHome();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
