import Image from "next/image";

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
  /**
   * Hint for next/image → sert la bonne taille selon le viewport.
   * Défaut : 100 vw sur mobile, 50 vw sur desktop (grosse majorité des cas).
   */
  sizes?: string;
  /** Priorité de chargement — active pour le LCP (hero, cover de page). */
  priority?: boolean;
};

const DEFAULT_FALLBACK = "/uploads/hero.jpg";
const DEFAULT_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px";

export default function Photo({
  src,
  label,
  ratio = "4 / 5",
  style,
  rounded = true,
  alt = "",
  fallback = DEFAULT_FALLBACK,
  objectPosition = "center center",
  sizes = DEFAULT_SIZES,
  priority = false,
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
        <Image
          src={effectiveSrc}
          alt={alt || label || ""}
          fill
          sizes={sizes}
          priority={priority}
          quality={78}
          style={{ objectFit: "cover", objectPosition }}
        />
      )}
    </div>
  );
}
