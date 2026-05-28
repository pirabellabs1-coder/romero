"use client";
import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";

type UploadResult = {
  inserted: number;
  skipped: { name: string; reason: string }[];
  errors: { name: string; message: string }[];
};

type Props = {
  galleryId: number;
  // Server Action that registers freshly-uploaded Blob URLs into the DB.
  registerAction: (
    galleryId: number,
    uploads: { url: string; name: string }[]
  ) => Promise<UploadResult>;
};

type Feedback =
  | { kind: "info"; text: string }
  | { kind: "ok"; text: string; details?: string[] }
  | { kind: "warn"; text: string; details?: string[] }
  | { kind: "error"; text: string; details?: string[] };

export default function UploadDropzone({ galleryId, registerAction }: Props) {
  const [pending, start] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hard cap per file, mirrors the server-side limit in the upload-token route.
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  const submit = (files: FileList | File[]) => {
    const all = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    const oversized = all.filter((f) => f.size > MAX_FILE_BYTES);
    const arr = all.filter((f) => f.size <= MAX_FILE_BYTES);

    if (oversized.length > 0 && arr.length === 0) {
      setFeedback({
        kind: "error",
        text: "Tous les fichiers dépassent 25 Mo.",
        details: oversized.map((f) => `${f.name} (${Math.round(f.size / 1024 / 1024)} Mo)`),
      });
      return;
    }
    if (arr.length === 0) {
      setFeedback({ kind: "error", text: "Aucune image valide sélectionnée." });
      return;
    }

    setFeedback(null);
    setProgress({ done: 0, total: arr.length });

    start(async () => {
      const uploaded: { url: string; name: string }[] = [];
      const errors: { name: string; message: string }[] = [];

      // Client → Blob direct, one file at a time so progress is reportable.
      // Sequential keeps the photographer's bandwidth from being saturated
      // and avoids hammering Blob with 50 concurrent uploads from a phone.
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        try {
          const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
          const pathname = `galleries/g${galleryId}/p${ts}-${safeName}`;
          const blob = await upload(pathname, f, {
            access: "public",
            handleUploadUrl: "/api/blob/upload-token",
          });
          uploaded.push({ url: blob.url, name: f.name });
        } catch (e) {
          errors.push({
            name: f.name,
            message: e instanceof Error ? e.message : String(e),
          });
        }
        setProgress({ done: i + 1, total: arr.length });
      }

      // All client-direct uploads done — now register them in the DB in
      // a single round trip.
      let registered: UploadResult = { inserted: 0, skipped: [], errors: [] };
      if (uploaded.length > 0) {
        try {
          registered = await registerAction(galleryId, uploaded);
        } catch (e) {
          errors.push({
            name: "(enregistrement)",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      setProgress(null);

      const allIssues = [
        ...oversized.map((f) => ({ name: f.name, reason: `Trop volumineux (${Math.round(f.size / 1024 / 1024)} Mo > 25 Mo)` })),
        ...registered.skipped,
      ];
      const allErrors = [...errors, ...registered.errors];

      const issueLines = [
        ...allErrors.map((e) => `❌ ${e.name} — ${e.message}`),
        ...allIssues.map((s) => `⚠ ${s.name} — ${s.reason}`),
      ];

      if (registered.inserted > 0 && issueLines.length === 0) {
        setFeedback({
          kind: "ok",
          text: `✓ ${registered.inserted} photo${registered.inserted > 1 ? "s ajoutées" : " ajoutée"} avec succès.`,
        });
        setTimeout(() => window.location.reload(), 700);
      } else if (registered.inserted > 0 && issueLines.length > 0) {
        setFeedback({
          kind: "warn",
          text: `${registered.inserted} ajoutée${registered.inserted > 1 ? "s" : ""}, ${issueLines.length} ignorée${issueLines.length > 1 ? "s" : ""}.`,
          details: issueLines,
        });
        setTimeout(() => window.location.reload(), 2400);
      } else {
        setFeedback({
          kind: "error",
          text: "Aucune photo ajoutée.",
          details: issueLines.length > 0 ? issueLines : ["Le serveur n'a renvoyé aucune erreur précise — réessayez."],
        });
      }
    });
  };

  const colors: Record<Feedback["kind"], { bg: string; fg: string; border: string }> = {
    info:  { bg: "rgba(184,151,90,.06)", fg: "var(--forest)",     border: "var(--rule)" },
    ok:    { bg: "rgba(157,178,154,.12)", fg: "var(--forest)",     border: "var(--sage-deep)" },
    warn:  { bg: "rgba(184,151,90,.10)", fg: "var(--gold-deep)",  border: "var(--gold)" },
    error: { bg: "rgba(139,46,46,.07)",  fg: "#8B2E2E",             border: "#C09595" },
  };

  return (
    <div>
      <div
        onClick={() => !pending && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (pending) return;
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
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) submit(e.target.files);
            // Reset so the same file selected twice re-triggers onChange.
            e.target.value = "";
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 32, color: "var(--gold)" }}>⤓</div>
          <div className="cap-tracked gold">
            {pending
              ? progress
                ? `Envoi ${progress.done}/${progress.total}…`
                : "Envoi en cours…"
              : "Cliquer ou déposer vos photos"}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>JPG, PNG, WebP, HEIC — jusqu&apos;à 25 Mo par fichier</div>
          {pending && progress && (
            <div style={{ width: "60%", maxWidth: 280, height: 4, background: "var(--rule)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
              <div style={{ height: "100%", width: `${(progress.done / progress.total) * 100}%`, background: "var(--gold)", transition: "width .25s ease" }} />
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          style={{
            marginTop: 14,
            padding: "12px 16px",
            background: colors[feedback.kind].bg,
            color: colors[feedback.kind].fg,
            border: `1px solid ${colors[feedback.kind].border}`,
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
