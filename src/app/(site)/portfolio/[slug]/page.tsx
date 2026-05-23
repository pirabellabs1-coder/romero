import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoupleGallery from "@/components/CoupleGallery";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getGallery, listPhotosForGallery, galleryIntro } from "@/lib/content";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = getGallery(params.slug);
  if (!g) return { title: "Galerie introuvable" };
  const desc = (g.intro_fr || "").slice(0, 200) || `Reportage du mariage de ${g.names} à ${g.place}.`;
  return {
    title: `${g.names} — ${g.place}`,
    description: desc,
    alternates: { canonical: `/portfolio/${g.slug}` },
    openGraph: {
      title: `${g.names} — ${g.place}`,
      description: desc,
      url: `/portfolio/${g.slug}`,
      images: g.cover_filename ? [{ url: `/uploads/${g.cover_filename}` }] : undefined,
    },
  };
}

export default function CouplePage({ params }: { params: { slug: string } }) {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const gallery = getGallery(params.slug);
  if (!gallery) notFound();
  const photos = listPhotosForGallery(gallery.id);
  return <CoupleGallery t={t} gallery={gallery} photos={photos} intro={galleryIntro(gallery, lang)} />;
}
