type Props = {
  width?: number;
  color?: string;
};

export default function OrnamentDivider({ width = 60, color = "var(--gold)" }: Props) {
  return (
    <div className="divider-ornament">
      <span className="line" style={{ width, background: color }} />
      <span className="diamond" style={{ background: color }} />
      <span className="line" style={{ width, background: color }} />
    </div>
  );
}
