type Props = {
  src?: string | null;
  label?: string;
  ratio?: string;
  style?: React.CSSProperties;
  rounded?: boolean;
  alt?: string;
  /** Fallback photo when src is null. Defaults to /uploads/hero.jpg */
  fallback?: string | null;
  /** CSS object-position when img is rendered (use to vary the crop on fallback) */
  objectPosition?: string;
};

const DEFAULT_FALLBACK = "/uploads/hero.jpg";

export default function Photo({
  src,
  label,
  ratio = "4 / 5",
  style,
  rounded = true,
  alt = "",
  fallback = DEFAULT_FALLBACK,
  objectPosition = "center center",
}: Props) {
  const effectiveSrc = src || fallback || null;
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: ratio,
        borderRadius: rounded ? 4 : 0,
        overflow: "hidden",
        background: "var(--cream-deep)",
        ...style,
      }}
    >
      {!effectiveSrc ? (
        <div className="placeholder" style={{ position: "absolute", inset: 0, borderRadius: rounded ? 4 : 0, border: 0 }}>
          <span>{label || "image"}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={effectiveSrc}
          alt={alt || label || ""}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
          }}
        />
      )}
    </div>
  );
}
