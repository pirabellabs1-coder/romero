"use client";
/**
 * Widget de chat flottant pour le site public.
 * ─────────────────────────────────────────────────────────────────────
 * Bulle en bas à droite qui déploie un panneau conversationnel.
 * Communique avec /api/chat. session_id persistant dans localStorage
 * pour que le visiteur puisse fermer / rouvrir sans perdre le fil.
 *
 * Exclusions :
 *   - /concours : la landing du concours a son propre design immersif
 *   - /admin/* : jamais dans le dashboard admin
 *
 * Accessibilité :
 *   - Bouton avec aria-label
 *   - Panneau annonce role="dialog"
 *   - Champ input avec aria-label
 *   - Focus renvoyé sur l'input à l'ouverture
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const EXCLUDED_PATHS = ["/concours", "/admin"];
const STORAGE_SESSION = "rp_chat_session";
const STORAGE_HISTORY = "rp_chat_history";
const STORAGE_OPEN = "rp_chat_open";
const MAX_HISTORY_LOCAL = 40;

const OPENING_MESSAGE =
  "Bonjour et bienvenue ! Je suis l'assistant du studio de Mickael Romero. Que puis-je vous dire sur son travail — ou sur votre projet de mariage ?";

type Msg = { role: "user" | "assistant"; content: string; ts: number };

// Filet de sécurité côté client : retire les marqueurs markdown si l'IA
// en glisse (**gras**, *italique*, `code`, ### titres, - listes). Le
// prompt système interdit déjà le markdown, ceci est une deuxième ligne.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function generateSessionId(): string {
  // 32 chars alphanumériques — suffisant en entropie, format compatible
  // avec la regex de validation côté serveur (16-128 alnum).
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function SiteChat() {
  const pathname = usePathname() ?? "/";
  const excluded = EXCLUDED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Hooks doivent être appelés inconditionnellement — on renvoie null en fin.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  // Init (session + historique local)
  useEffect(() => {
    setMounted(true);
    try {
      let sid = localStorage.getItem(STORAGE_SESSION);
      if (!sid) {
        sid = generateSessionId();
        localStorage.setItem(STORAGE_SESSION, sid);
      }
      setSessionId(sid);
      const raw = localStorage.getItem(STORAGE_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
      const wasOpen = localStorage.getItem(STORAGE_OPEN);
      if (wasOpen === "1") setOpen(true);
    } catch {
      // localStorage indisponible (mode privé) — on continue en mémoire
    }
  }, []);

  // Persist messages
  useEffect(() => {
    if (!mounted) return;
    try {
      const tail = messages.slice(-MAX_HISTORY_LOCAL);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(tail));
    } catch {}
  }, [messages, mounted]);

  // Persist open state
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_OPEN, open ? "1" : "0");
    } catch {}
  }, [open, mounted]);

  // Auto-scroll thread on new message
  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, sending]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          user_agent: navigator.userAgent.slice(0, 400),
          referrer: document.referrer.slice(0, 400),
        }),
      });
      const data = (await resp.json()) as
        | { ok: true; reply: string }
        | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, ts: Date.now() },
      ]);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erreur inconnue. Merci de réessayer.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [input, sending, sessionId]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    if (!confirm("Effacer la conversation en cours ? Une nouvelle session sera créée.")) return;
    try {
      const sid = generateSessionId();
      localStorage.setItem(STORAGE_SESSION, sid);
      localStorage.removeItem(STORAGE_HISTORY);
      setSessionId(sid);
      setMessages([]);
      setError(null);
    } catch {}
  }

  if (!mounted || excluded) return null;

  const hasMessages = messages.length > 0;
  const displayMessages: Msg[] = hasMessages
    ? messages
    : [{ role: "assistant", content: OPENING_MESSAGE, ts: Date.now() }];

  return (
    <>
      {/* Bulle */}
      {!open && (
        <button
          type="button"
          className="rp-chat-bubble"
          aria-label="Discuter avec l'assistant du studio"
          onClick={() => setOpen(true)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.7A.6.6 0 0 1 6 20.3V17H6.5A2.5 2.5 0 0 1 4 14.5v-9Z"
              fill="currentColor"
            />
          </svg>
          <span className="rp-chat-bubble__dot" aria-hidden />
        </button>
      )}

      {/* Panneau */}
      {open && (
        <div
          className="rp-chat-panel"
          role="dialog"
          aria-label="Assistant du studio Romero Photography"
        >
          <header className="rp-chat-panel__head">
            <div className="rp-chat-panel__title">
              <span className="rp-chat-panel__eyebrow">Assistant · en ligne</span>
              <span className="rp-chat-panel__name">Romero Photography</span>
            </div>
            <div className="rp-chat-panel__actions">
              <button
                type="button"
                className="rp-chat-panel__icon-btn"
                aria-label="Effacer et recommencer"
                title="Effacer et recommencer"
                onClick={reset}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 4h12M9 4V2h6v2M8 4v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="rp-chat-panel__icon-btn"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M6 18L18 6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          <div ref={threadRef} className="rp-chat-panel__thread">
            {displayMessages.map((m, i) => (
              <div
                key={i}
                className={`rp-chat-msg rp-chat-msg--${m.role}`}
              >
                <div className="rp-chat-msg__bubble">{stripMarkdown(m.content)}</div>
              </div>
            ))}
            {sending ? (
              <div className="rp-chat-msg rp-chat-msg--assistant">
                <div className="rp-chat-msg__bubble rp-chat-typing" aria-label="L'assistant écrit">
                  <span /><span /><span />
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="rp-chat-error" role="alert">
                ✗ {error}
              </div>
            ) : null}
          </div>

          <div className="rp-chat-panel__composer">
            <textarea
              ref={inputRef}
              aria-label="Votre message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Écrivez votre message… (Entrée pour envoyer)"
              rows={1}
              disabled={sending}
            />
            <button
              type="button"
              className="rp-chat-panel__send"
              aria-label="Envoyer le message"
              onClick={send}
              disabled={sending || !input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20l16-8L4 4v6l10 2-10 2v6z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <div className="rp-chat-panel__foot">
            Vos échanges aident Mickael à vous répondre au mieux.
          </div>
        </div>
      )}
    </>
  );
}
