"use client";
import { useRef, useState, useTransition } from "react";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export default function UploadDropzone({ action }: Props) {
  const [pending, start] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const fd = new FormData();
    for (const f of arr) fd.append("files", f);
    setProgress(`Envoi de ${arr.length} photo${arr.length > 1 ? "s" : ""}…`);
    start(async () => {
      try {
        await action(fd);
        setProgress(`✓ ${arr.length} photo${arr.length > 1 ? "s ajoutées" : " ajoutée"}`);
        setTimeout(() => setProgress(null), 3000);
      } catch {
        setProgress("✗ Erreur pendant l'upload");
        setTimeout(() => setProgress(null), 3500);
      }
    });
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
          <div className="muted" style={{ fontSize: 12 }}>JPG, PNG, WebP — plusieurs fichiers à la fois</div>
          {progress && (
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--forest)" }}>{progress}</div>
          )}
        </div>
      </div>
    </div>
  );
}
