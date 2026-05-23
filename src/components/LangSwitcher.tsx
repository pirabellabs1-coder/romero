"use client";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  variant?: "header" | "footer";
};

export default function LangSwitcher({ lang, variant = "header" }: Props) {
  const router = useRouter();

  const setLang = (l: Lang) => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  if (variant === "footer") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.22em", marginTop: 26 }}>
        <span onClick={() => setLang("fr")} style={{ cursor: "pointer", color: lang === "fr" ? "var(--gold-light)" : "#9B948A" }}>FR</span>
        <span style={{ color: "#5C6258" }}>·</span>
        <span onClick={() => setLang("en")} style={{ cursor: "pointer", color: lang === "en" ? "var(--gold-light)" : "#9B948A" }}>EN</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, letterSpacing: "0.18em", fontWeight: 500 }}>
      <span onClick={() => setLang("fr")} style={{ cursor: "pointer", color: lang === "fr" ? "var(--gold)" : "var(--muted)" }}>FR</span>
      <span style={{ color: "var(--rule)" }}>·</span>
      <span onClick={() => setLang("en")} style={{ cursor: "pointer", color: lang === "en" ? "var(--gold)" : "var(--muted)" }}>EN</span>
    </div>
  );
}
