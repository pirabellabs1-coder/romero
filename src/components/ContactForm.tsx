"use client";
import { useState } from "react";
import Monogram from "@/components/Monogram";
import OrnamentDivider from "@/components/OrnamentDivider";
import type { Strings, Lang } from "@/lib/i18n";

type Props = { t: Strings; lang: Lang };

export default function ContactForm({ t, lang }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    date: "",
    place: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lang }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSent(true);
    } catch {
      setError(t.contact.form.error);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ background: "var(--cream)", padding: "50px 56px", border: "1px solid var(--rule)" }}>
      {sent ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <Monogram size={60} label={false} />
          <OrnamentDivider />
          <h3 className="serif" style={{ fontSize: 30, color: "var(--forest)", fontWeight: 400 }}>
            {lang === "en" ? "Thank you." : "Merci."}
          </h3>
          <p className="muted" style={{ marginTop: 12, fontSize: 16 }}>
            {t.contact.form.sent}
          </p>
        </div>
      ) : (
        <>
          {error && (
            <div className="admin-flash error" style={{ marginBottom: 20 }}>
              {error}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <Field label={t.contact.form.firstName}>
              <input className="input" required value={form.firstName} onChange={onChange("firstName")} />
            </Field>
            <Field label={t.contact.form.lastName}>
              <input className="input" required value={form.lastName} onChange={onChange("lastName")} />
            </Field>
            <Field label={t.contact.form.email}>
              <input type="email" className="input" required value={form.email} onChange={onChange("email")} />
            </Field>
            <Field label={t.contact.form.phone}>
              <input type="tel" className="input" value={form.phone} onChange={onChange("phone")} />
            </Field>
            <Field label={t.contact.form.date}>
              <input type="date" className="input" value={form.date} onChange={onChange("date")} />
            </Field>
            <Field label={t.contact.form.place}>
              <input className="input" placeholder="Nice, Èze, Cap Ferrat..." value={form.place} onChange={onChange("place")} />
            </Field>
          </div>
          <div style={{ marginTop: 36 }}>
            <Field label={t.contact.form.message}>
              <textarea
                className="input textarea"
                rows={5}
                placeholder={t.contact.form.messagePh}
                value={form.message}
                onChange={onChange("message")}
                style={{ resize: "none", minHeight: 120, paddingTop: 12 }}
                required
              />
            </Field>
          </div>
          <button type="submit" disabled={pending} className="btn btn-sage" style={{ marginTop: 40, width: "100%", opacity: pending ? 0.6 : 1 }}>
            {pending ? "…" : t.contact.form.submit}
          </button>
        </>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
