type Props = {
  rating?: number;
  color?: string;
  size?: number;
};

export default function Stars({ rating = 5, color = "#D4AF37", size = 14 }: Props) {
  return (
    <span style={{ color, letterSpacing: 2, fontSize: size }}>
      {"★★★★★".slice(0, rating)}
      <span style={{ color: "#DDD" }}>{"★★★★★".slice(rating)}</span>
    </span>
  );
}
