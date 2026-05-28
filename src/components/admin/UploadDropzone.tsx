"use client";
import { useRef, useState, useTransition } from "react";

type UploadResult = {
  inserted: number;
  skipped: { name: string; reason: string }[];
  errors: { name: string; message: string }[];
};

type Props = {
  // Returns a structured report from the server so we can show the user
  // exactly what was uploaded, what was skipped, and why. Without this,
  // the dropzone used to flash "photos ajoutées" even when zero photos
  // actually made it to the DB (e.g. when each file exceeded the Server
  // Action body limit and was silently dropped).
  action: (formData: FormData) => Promise<UploadResult>;
};

type Feedback =
  | { kind: "info"; text: string }
  | { kind: "ok"; text: string; details?: string[] }
  | { kind: "warn"; text: string; details?: string[] }
  | { kind: "error"; text: string; details?: string[] };

export default function UploadDropzone({ action }: Props) {
  const [pending, start] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hard cap on individual file size — must match the server-side check
  // in galleries/actions.ts uploadPhoto. Rejecting client-side gives
  // the user instant feedback instead of a silent skip.
  const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

  const submit = (files: FileList | File[]) => {
    const all = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const oversizedClient = all.filter((f) => f.size > MAX_FILE_BYTES);
    const arr = all.filter((f) => f.size <= MAX_FILE_BYTES);

    if (oversizedClient.length > 0 && arr.length === 0) {
      setFeedback({
        kind: "error",
        text: `Tous les fichiers dépassent 25 Mo.`,
        details: oversizedClient.map((f) => `${f.name} (${Math.round(f.size / 1024 / 1024)} Mo)`),
      });
      return;
    }
    if (arr.length === 0) {
      setFeedback({ kind: "error", text: "Aucune image valide sélectionnée." });
      return;
    }

    const fd = new FormData();
    for (const f of arr) fd.append("files", f);
    setFeedback({ kind: "info", text: `Envoi de ${arr.length} photo${arr.length > 1 ? "s" : ""}…` });

    start(async () => {
      try {
        const res = await action(fd);
        const { inserted, skipped, errors } = res;

        if (inserted === 0 && skipped.length === 0 && errors.length === 0) {
          // Nothing reached the server at all — most likely the Server Action
          // body limit silently dropped everything.
          setFeedback({
            kind: "error",
            text: "Aucune photo n'a été reçue par le serveur.",
            details: ["Vérifiez votre connexion ou réduisez la taille des fichiers."],
          });
          return;
        }

        // Build a combined details list (errors + skipped)
        const issues = [
          ...errors.map((e) => `❌ ${e.name} — ${e.message}`),
          ...skipped.map((s) => `⚠ ${s.name} — ${s.reason}`),
        ];

        if (inserted > 0 && issues.length === 0) {
          setFeedback({
            kind: "ok",
            text: `✓ ${inserted} photo${inserted > 1 ? "s ajoutées" : " ajoutée"} avec succès.`,
          });
          // Force a refresh so the new tiles appear without a manual reload.
          setTimeout(() => window.location.reload(), 800);
        } else if (inserted > 0 && issues.length > 0) {
          setFeedback({
            kind: "warn",
            text: `${inserted} photo${inserted > 1 ? "s ajoutées" : " ajoutée"}, ${issues.length} ignorée${issues.length > 1 ? "s" : ""}.`,
            details: issues,
          });
          setTimeout(() => window.location.reload(), 2400);
        } else {
          setFeedback({
            kind: "error",
            text: `Aucune photo ajoutée — ${issues.length} problème${issues.length > 1 ? "s" : ""} détecté${issues.length > 1 ? "s" : ""}.`,
            details: issues,
          });
        }
      } catch (e) {
        setFeedback({
          kind: "error",
          text: "Erreur pendant l'upload.",
          details: [e instanceof Error ? e.message : String(e)],
        });
      }
    });
  };

  const feedbackColor: Record<Feedback["kind"], { bg: string; fg: string; border: string }> = {
    info:  { bg: "rgba(184,151,90,.06)", fg: "var(--forest)",  border: "var(--rule)" },
    ok:    { bg: "rgba(157,178,154,.12)", fg: "var(--forest)", border: "var(--sage-deep)" },
    warn:  { bg: "rgba(184,151,90,.10)", fg: "var(--gold-deep)", border: "var(--gold)" },
    error: { bg: "rgba(139,46,46,.07)", fg: "#8B2E2E",         border: "#C09595" },
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) submit(e.dataTransfer.files);
        }}
        className="upload-dropzone"
        style={{
          borderColor: dragOver ? "var(--gold)" : "var(--rule)",
          background: dragOver ? "rgba(184,151,90,.06)" : "transparent",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          name="files"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) submit(e.target.files);
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 32, color: "var(--gold)" }}>⤓</div>
          <div className="cap-tracked gold">{pending ? "Envoi en cours…" : "Cliquer ou déposer vos photos"}</div>
          <div className="muted" style={{ fontSize: 12 }}>JPG, PNG, WebP — jusqu&apos;à 25 Mo par fichier</div>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          style={{
            marginTop: 14,
            padding: "12px 16px",
            background: feedbackColor[feedback.kind].bg,
            color: feedbackColor[feedback.kind].fg,
            border: `1px solid ${feedbackColor[feedback.kind].border}`,
            borderRadius: 4,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 500 }}>{feedback.text}</div>
          {"details" in feedback && feedback.details && feedback.details.length > 0 && (
            <ul style={{ margin: "8px 0 0 0", padding: "0 0 0 18px", fontSize: 12.5 }}>
              {feedback.details.map((d, i) => (
                <li key={i} style={{ marginBottom: 3 }}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
