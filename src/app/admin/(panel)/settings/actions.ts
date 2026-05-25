"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSettings } from "@/lib/settings";
import { requireUser } from "@/lib/auth";

const ALLOWED = new Set([
  "contact_city",
  "contact_phone",
  "contact_email",
  "instagram_handle",
  "instagram_url",
  "google_reviews_url",
]);

export async function updateContactSettings(formData: FormData) {
  requireUser();
  const updates: Record<string, string> = {};
  for (const key of ALLOWED) {
    const v = formData.get(key);
    if (typeof v === "string") updates[key] = v.trim();
  }
  setSettings(updates);
  revalidatePath("/", "layout");
  redirect("/admin/settings?ok=1");
}
