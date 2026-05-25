import OrnamentDivider from "@/components/OrnamentDivider";
import Photo from "@/components/Photo";

type ImageProps = { src?: string | null; label?: string; objectPosition?: string };

type Props = {
  eyebrow: string;
  title: string;
  accent: string;
  lead?: string;
  image?: ImageProps;
};

export default function PageEyebrow({ eyebrow, title, accent, lead, image }: Props) {
  return (
    <section style={{ position: "relative", paddingTop: 160, paddingBottom: 80, background: "var(--cream)", overflow: "hidden" }}>
      <div className="watercolor" />
      <div
        className={`container-wide page-eyebrow-grid${image ? " with-image" : ""}`}
        style={{ position: "relative" }}
      >
        <div className="page-enter page-eyebrow-text">
          <div className="cap-tracked gold" style={{ marginBottom: 28 }}>
            {eyebrow}
          </div>
          <h1 className="h-display" style={{ margin: 0 }}>
            {title}
            <br />
            <span className="italic-gold" style={{ fontStyle: "italic" }}>{accent}</span>
          </h1>
          <OrnamentDivider />
          {lead && (
            <p className="lead muted page-eyebrow-lead" style={{ marginTop: 28 }}>
              {lead}
            </p>
          )}
        </div>
        {image && (
          <div className="page-enter page-eyebrow-photo">
            <Photo src={image.src ?? null} label={image.label} ratio="4 / 5" objectPosition={image.objectPosition ?? "center center"} />
          </div>
        )}
      </div>
    </section>
  );
}
