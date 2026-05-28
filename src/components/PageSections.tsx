import Link from "next/link";
import { listSectionsForPage, type PageSection, type TextSectionData, type TextImageSectionData, type QuoteSectionData, type FullImageSectionData } from "@/lib/page-sections";
import OrnamentDivider from "@/components/OrnamentDivider";
import Monogram from "@/components/Monogram";
import type { Lang } from "@/lib/i18n";

type Props = {
  page: string;
  lang: Lang;
};

/**
 * Public renderer for the photographer's custom modular sections.
 * Each row in page_sections becomes one rendered block. Type-specific
 * components handle the four flavours: text, text-image, quote,
 * full-image.
 *
 * Empty fields fall through to nothing (so a section in draft state with
 * only a title doesn't show ugly empty paragraphs).
 */
export default async function PageSections({ page, lang }: Props) {
  const sections = await listSectionsForPage(page);
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} lang={lang} />
      ))}
    </>
  );
}

function pickL<T extends Record<string, unknown>>(d: T, base: string, lang: Lang): string {
  const key = `${base}_${lang}` as keyof T;
  const fallback = `${base}_fr` as keyof T;
  const v = (d[key] as string) || (d[fallback] as string) || "";
  return v;
}

function SectionRenderer({ section, lang }: { section: PageSection; lang: Lang }) {
  switch (section.type) {
    case "text":       return <TextSection data={section.data as TextSectionData} lang={lang} />;
    case "text-image": return <TextImageSection data={section.data as TextImageSectionData} lang={lang} />;
    case "quote":      return <QuoteSection data={section.data as QuoteSectionData} lang={lang} />;
    case "full-image": return <FullImageSection data={section.data as FullImageSectionData} lang={lang} />;
    default:           return null;
  }
}

// ── ① Text ─────────────────────────────────────────────────────────
function TextSection({ data, lang }: { data: TextSectionData; lang: Lang }) {
  const eyebrow = pickL(data, "eyebrow", lang);
  const title = pickL(data, "title", lang);
  const body = pickL(data, "body", lang);
  if (!eyebrow && !title && !body) return null;
  const align = data.align ?? "center";
  const bg = data.background === "cream-deep" ? "var(--cream-deep)" : data.background === "white" ? "#fff" : "var(--cream)";
  return (
    <section className="section-pad" style={{ background: bg, textAlign: align }}>
      <div className="container">
        {eyebrow && <div className="cap-tracked gold">{eyebrow}</div>}
        {title && (
          <h2 className="h-section" style={{ marginTop: 14 }}>{title}</h2>
        )}
        {align === "center" && (title || eyebrow) && <OrnamentDivider />}
        {body && (
          <p className="lead muted" style={{ marginTop: 22, maxWidth: 720, marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0, whiteSpace: "pre-line" }}>
            {body}
          </p>
        )}
      </div>
    </section>
  );
}

// ── ② Text + Image ────────────────────────────────────────────────
function TextImageSection({ data, lang }: { data: TextImageSectionData; lang: Lang }) {
  const eyebrow = pickL(data, "eyebrow", lang);
  const title = pickL(data, "title", lang);
  const body = pickL(data, "body", lang);
  const cta = pickL(data, "cta_label", lang);
  const right = data.image_position !== "left";
  const url = data.image_url;
  const focal = data.image_focal || "center center";
  if (!url && !title && !body) return null;
  const textCol = (
    <div>
      {eyebrow && <div className="cap-tracked gold">{eyebrow}</div>}
      {title && <h2 className="h-section" style={{ marginTop: 14 }}>{title}</h2>}
      {body && <p className="lead muted" style={{ marginTop: 22, whiteSpace: "pre-line" }}>{body}</p>}
      {cta && data.cta_href && (
        <Link href={data.cta_href} className="btn btn-sage" style={{ marginTop: 28 }}>{cta}</Link>
      )}
    </div>
  );
  const imgCol = (
    <div style={{ aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 4 }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title || ""} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focal }} />
      )}
    </div>
  );
  return (
    <section className="section-pad" style={{ background: "var(--cream)" }}>
      <div className="container-wide">
        <div className="responsive-2col">
          {right ? <>{textCol}{imgCol}</> : <>{imgCol}{textCol}</>}
        </div>
      </div>
    </section>
  );
}

// ── ③ Quote ───────────────────────────────────────────────────────
function QuoteSection({ data, lang }: { data: QuoteSectionData; lang: Lang }) {
  const quote = pickL(data, "quote", lang);
  if (!quote) return null;
  return (
    <section style={{ background: "var(--sage-soft)", padding: "100px 0", position: "relative", overflow: "hidden" }}>
      <div className="container" style={{ textAlign: "center", position: "relative" }}>
        <Monogram size={48} label={false} />
        <OrnamentDivider />
        <p className="serif" style={{ fontSize: "clamp(22px, 2.4vw, 32px)", color: "var(--forest)", lineHeight: 1.4, marginTop: 28, fontStyle: "italic", maxWidth: 820, margin: "28px auto 18px" }}>
          {quote}
        </p>
        {data.author && <div className="cap-tracked-sm gold" style={{ marginTop: 14 }}>{data.author}</div>}
      </div>
    </section>
  );
}

// ── ④ Full-width image ────────────────────────────────────────────
function FullImageSection({ data, lang }: { data: FullImageSectionData; lang: Lang }) {
  const caption = pickL(data, "caption", lang);
  if (!data.image_url) return null;
  return (
    <section style={{ background: "var(--cream)" }}>
      <div style={{ width: "100%", aspectRatio: "16 / 9", overflow: "hidden", maxHeight: 720 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.image_url}
          alt={caption || "Photo"}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: data.image_focal || "center center" }}
        />
      </div>
      {caption && (
        <div className="container" style={{ padding: "16px 0 0", textAlign: "center" }}>
          <p className="muted" style={{ fontSize: 13, fontStyle: "italic" }}>{caption}</p>
        </div>
      )}
    </section>
  );
}
