"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type PromptOptions = {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: "text" | "url";
};

type ConfirmState = { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void };
type PromptState = { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };
type State = ConfirmState | PromptState;
type Listener = (state: State) => void;

let listener: Listener | null = null;

/** Confirm dialog returning a Promise<boolean>. Drop-in replacement for window.confirm. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm(opts.message));
      return;
    }
    listener({ kind: "confirm", opts, resolve });
  });
}

/** Prompt dialog returning a Promise<string | null>. Drop-in replacement for window.prompt. */
export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.prompt(opts.message, opts.defaultValue ?? ""));
      return;
    }
    listener({ kind: "prompt", opts, resolve });
  });
}

export default function ModalProvider() {
  const [state, setState] = useState<State | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    listener = (s) => {
      setState(s);
      if (s.kind === "prompt") setInputValue(s.opts.defaultValue ?? "");
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (e.key === "Enter" && state.kind === "confirm") {
        e.preventDefault();
        ok();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const cancel = () => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(false);
    else state.resolve(null);
    setState(null);
  };

  const ok = () => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(true);
    else state.resolve(inputValue);
    setState(null);
  };

  if (!mounted || !state) return null;

  const isDanger = state.kind === "confirm" && state.opts.tone === "danger";

  return createPortal(
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && cancel()} role="dialog" aria-modal="true">
      <div className="modal-card">
        {state.opts.title && <h3 className="modal-title">{state.opts.title}</h3>}
        <p className="modal-message">{state.opts.message}</p>

        {state.kind === "prompt" && (
          <div style={{ marginTop: 14 }}>
            <input
              autoFocus
              type={state.opts.inputType ?? "text"}
              className="admin-input"
              placeholder={state.opts.placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ok()}
            />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-ghost" onClick={cancel}>
            {state.opts.cancelLabel ?? "Annuler"}
          </button>
          <button type="button" className={`modal-btn ${isDanger ? "modal-btn-danger" : "modal-btn-primary"}`} onClick={ok} autoFocus={state.kind === "confirm"}>
            {state.opts.confirmLabel ?? (isDanger ? "Supprimer" : "Confirmer")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
