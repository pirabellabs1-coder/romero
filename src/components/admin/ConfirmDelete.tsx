"use client";
import { useTransition } from "react";
import { confirmDialog } from "@/components/ui/Modal";

type Props = {
  action: () => Promise<void>;
  label?: string;
  confirmText?: string;
  title?: string;
};

export default function ConfirmDelete({
  action,
  label = "SUPPRIMER",
  confirmText = "Êtes-vous sûr ? Cette action est irréversible.",
  title = "Confirmer la suppression",
}: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="admin-btn danger"
      disabled={pending}
      onClick={async () => {
        const ok = await confirmDialog({
          title,
          message: confirmText,
          tone: "danger",
          confirmLabel: "Supprimer définitivement",
          cancelLabel: "Annuler",
        });
        if (ok) start(() => action());
      }}
    >
      {pending ? "Suppression…" : label}
    </button>
  );
}
