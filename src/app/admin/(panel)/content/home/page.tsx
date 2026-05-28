import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { listGalleries, coverFor } from "@/lib/content";
import HomeContentEditor from "@/components/admin/HomeContentEditor";
import { saveContentFields, saveContentPhoto } from "../actions";

export const dynamic = "force-dynamic";

const DEFAULT_HERO = "/uploads/hero.jpg";

// Flatten the home strings (including the `values` array) into a flat
// Record<key, value> for both languages, so the editor can do a uniform
// key-by-key comparison against overrides.
function flatHomeDefaults(lang: "fr" | "en"): Record<string, string> {
  const home = STRINGS[lang].home as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(home)) {
    if (typeof v === "string") out[k] = v;
  }
  const values = home.values as unknown as Array<[string, string]>;
  values?.forEach(([t, b], i) => {
    out[`values_${i}_title`] = t;
    out[`values_${i}_body`] = b;
  });
  return out;
}

async function saveHero(url: string) {
  "use server";
  return saveContentPhoto("home", "hero_photo", url);
}

export default async function HomeContentPage() {
  const overrides = await getPageContentBilingual("home");
  const featuredGals = (await listGalleries({ featuredOnly: true })).slice(0, 3);
  const featuredCovers = await Promise.all(
    featuredGals.map((g) => coverFor(g, `home-featured-${g.slug}`))
  );
  const featured = featuredGals.map((g, i) => ({
    id: g.id,
    slug: g.slug,
    names: g.names,
    place: g.place,
    coverUrl: featuredCovers[i],
    coverPosition: g.cover_position || "center center",
  }));

  const heroPhoto = overrides.fr["hero_photo"] || DEFAULT_HERO;
  // The hero_photo "override" isn't a translatable string; drop it from
  // the text fields the editor displays.
  const { hero_photo: _hpFr, ...frTexts } = overrides.fr;
  const { hero_photo: _hpEn, ...enTexts } = overrides.en;
  void _hpFr; void _hpEn;

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Accueil</h1>
      <p className="admin-sub">
        Modifiez chaque texte et photo dans l&apos;ordre d&apos;apparition. Switchez entre FR et EN avec les boutons en haut.
      </p>

      <HomeContentEditor
        initialFr={frTexts}
        initialEn={enTexts}
        defaultsFr={flatHomeDefaults("fr")}
        defaultsEn={flatHomeDefaults("en")}
        featured={featured}
        heroPhoto={heroPhoto}
        saveAction={saveContentFields}
        saveHeroAction={saveHero}
      />
    </>
  );
}
