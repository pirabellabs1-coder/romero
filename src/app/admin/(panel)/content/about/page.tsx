import Link from "next/link";
import { getPageContentBilingual, getPageContent } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";
import AboutContentEditor from "@/components/admin/AboutContentEditor";
import { saveContentFields, saveContentPhoto } from "../actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

function flatAboutDefaults(lang: "fr" | "en"): Record<string, string> {
  const about = STRINGS[lang].about as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(about)) {
    if (typeof v === "string") out[k] = v;
  }
  (about.body as string[] | undefined)?.forEach((p, i) => { out[`body_${i}`] = p; });
  (about.values as Array<[string, string]> | undefined)?.forEach(([t, b], i) => {
    out[`values_${i}_title`] = t; out[`values_${i}_body`] = b;
  });
  (about.process as Array<[string, string]> | undefined)?.forEach(([t, b], i) => {
    out[`process_${i}_title`] = t; out[`process_${i}_body`] = b;
  });
  (about.gear as string[] | undefined)?.forEach((g, i) => { out[`gear_${i}`] = g; });
  return out;
}

async function saveAboutEyebrowPhoto(url: string) {
  "use server";
  return saveContentPhoto("about", "photo_eyebrow", url);
}
async function saveAboutStoryPhoto(url: string) {
  "use server";
  return saveContentPhoto("about", "photo_story", url);
}

export default async function AboutContentPage() {
  cmsPageGuard("about");
  const [overrides, fallbackPool, frOnly] = await Promise.all([
    getPageContentBilingual("about"),
    pickShowcasePhotos(2, "about-v1"),
    getPageContent("about", "fr"),
  ]);
  const eyebrowPhotoUrl = frOnly["photo_eyebrow"] || photoUrl(fallbackPool[0]) || "/uploads/hero.jpg";
  const storyPhotoUrl   = frOnly["photo_story"]   || photoUrl(fallbackPool[1]) || "/uploads/hero.jpg";

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page À propos</h1>
      <p className="admin-sub">Chaque bloc reproduit exactement la structure de la page publique — photos et textes à leurs positions réelles.</p>

      <AboutContentEditor
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatAboutDefaults("fr")}
        defaultsEn={flatAboutDefaults("en")}
        eyebrowPhotoUrl={eyebrowPhotoUrl}
        storyPhotoUrl={storyPhotoUrl}
        saveAction={saveContentFields}
        saveEyebrowPhotoAction={saveAboutEyebrowPhoto}
        saveStoryPhotoAction={saveAboutStoryPhoto}
      />
    </>
  );
}
