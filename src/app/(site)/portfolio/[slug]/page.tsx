import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoupleGallery from "@/components/CoupleGallery";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getGallery, listPhotosForGallery, galleryIntro } from "@/lib/content";
import { imageGallerySchema, breadcrumbList, jsonLdScript } from "@/lib/jsonld";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const g = await getGallery(params.slug);
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
      images: g.cover_filename
        ? [{ url: g.cover_filename.startsWith("http") ? g.cover_filename : `/uploads/${g.cover_filename}` }]
        : undefined,
    },
  };
}

export default async function CouplePage({ params }: { params: { slug: string } }) {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const gallery = await getGallery(params.slug);
  if (!gallery) notFound();
  const photos = await listPhotosForGallery(gallery.id);
  const intro = galleryIntro(gallery, lang);

  const ldGallery = imageGallerySchema({
    slug: gallery.slug,
    names: gallery.names,
    place: gallery.place,
    date: gallery.date_label,
    intro,
    images: photos.map((p) => ({ filename: p.filename, alt: p.alt || `${gallery.names} — ${gallery.place}` })),
  });
  const ldBreadcrumb = breadcrumbList([
    { name: lang === "en" ? "Home" : "Accueil", url: "/" },
    { name: "Portfolio", url: "/portfolio" },
    { name: gallery.names, url: `/portfolio/${gallery.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ldGallery) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ldBreadcrumb) }} />
      <CoupleGallery t={t} gallery={gallery} photos={photos} intro={intro} />
    </>
  );
}
