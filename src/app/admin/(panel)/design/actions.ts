"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSettings } from "@/lib/settings";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";

const ALLOWED = new Set([
  "accent",
  "background",
  "foreground",
  "sage_tone",
  "display_font",
  "body_font",
  "image_treatment",
  "italic_titles",
  "watercolor",
  "ornaments",
  "section_density",
  "image_radius",
  "caps_tracking",
  "font_scale",
  "monogram_style",
  "header_style",
  "button_style",
]);

export async function updateDesign(formData: FormData) {
  requireUser();
  const updates: Record<string, string> = {};
  for (const key of ALLOWED) {
    const v = formData.get(key);
    if (typeof v === "string") {
      updates[key] = v;
    } else if (key === "italic_titles" || key === "watercolor") {
      // checkbox not checked → "0"
      updates[key] = "0";
    }
  }
  // Coerce checkboxes that may have been sent as "on"
  for (const k of ["italic_titles", "watercolor"]) {
    const v = formData.get(k);
    if (v === "on" || v === "1") updates[k] = "1";
  }
  await setSettings(updates);
  await syncDb();
  revalidatePath("/", "layout");
  redirect("/admin/design?ok=1");
}

export async function applyPreset(name: string) {
  requireUser();
  const presets: Record<string, Record<string, string>> = {
    provence: {
      accent: "#B8975A", background: "cream", foreground: "forest", sage_tone: "sage",
      display_font: "Cormorant Garamond", body_font: "Inter",
    },
    minimal: {
      accent: "#9C7A4F", background: "pearl", foreground: "charcoal", sage_tone: "smoke",
      display_font: "Tenor Sans", body_font: "Jost", ornaments: "subtle", watercolor: "0",
    },
    rose: {
      accent: "#B98B86", background: "blush", foreground: "wine", sage_tone: "celadon",
      display_font: "Playfair Display", body_font: "Montserrat",
    },
    night: {
      accent: "#C2A878", background: "stone", foreground: "midnight", sage_tone: "dusty",
      display_font: "DM Serif Display", body_font: "Work Sans", italic_titles: "1",
    },
    vintage: {
      accent: "#6E5945", background: "almond", foreground: "espresso", sage_tone: "olive",
      display_font: "EB Garamond", body_font: "Lato", image_treatment: "sepia",
    },
  };
  const p = presets[name];
  if (!p) return;
  await setSettings(p);
  await syncDb();
  revalidatePath("/", "layout");
  redirect(`/admin/design?ok=preset`);
}
