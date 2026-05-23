import Link from "next/link";
import type { Strings } from "@/lib/i18n";

export default function CTABlock({ t }: { t: Strings }) {
  return (
    <section style={{ background: "var(--sage-soft)", padding: "70px 0", borderTop: "1px solid var(--rule)" }}>
      <div
        className="container"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}
      >
        <div>
          <div className="cap-tracked gold" style={{ marginBottom: 8 }}>
            {t.cta.question}
          </div>
          <div className="serif" style={{ fontSize: 28, color: "var(--forest)" }}>
            {t.cta.line1}{" "}
            <span style={{ fontStyle: "italic", color: "var(--gold)" }}>{t.cta.line2}</span>
          </div>
        </div>
        <Link href="/contact" className="btn btn-sage">
          {t.book}
        </Link>
      </div>
    </section>
  );
}
