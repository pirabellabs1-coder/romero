"use client";
import { useState, useTransition } from "react";
import { runPlaygroundMessage } from "../actions";
import type { AgentTestMessage } from "@/lib/agents";

type Props = {
  slug: string;
  history: AgentTestMessage[];
};

export default function Playground({ slug, history }: Props) {
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<{
    output: string;
    duration_ms: number;
    ok: boolean;
  } | null>(null);
  const [items, setItems] = useState(history);

  function run() {
    if (!input.trim()) return;
    const userMessage = input;
    setCurrent(null);
    startTransition(async () => {
      const res = await runPlaygroundMessage(slug, userMessage);
      if (res.ok) {
        setCurrent({ output: res.output, duration_ms: res.duration_ms, ok: true });
        setItems((prev) => [
          {
            id: Date.now(),
            agent_slug: slug as AgentTestMessage["agent_slug"],
            input_text: userMessage,
            output_text: res.output,
            prompt_snapshot: "",
            duration_ms: res.duration_ms,
            success: true,
            error_message: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setInput("");
      } else {
        setCurrent({ output: res.error, duration_ms: 0, ok: false });
      }
    });
  }

  return (
    <div className="agent-detail">
      <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Playground — tester l'agent en conditions réelles</h2>
        <p style={{ marginTop: -6, marginBottom: 20 }}>
          Envoyez un message comme le ferait un utilisateur final. L'agent
          répond avec son prompt système actuel + sa base de connaissances.
          Chaque test est archivé pour comparer les rendus.
        </p>

        <div className="agent-form-field">
          <label htmlFor="pg-input">Message utilisateur</label>
          <textarea
            id="pg-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex : Bonjour, je me marie le 12 juin 2027 dans le Var, êtes-vous disponible ?"
            style={{ minHeight: 100 }}
          />
        </div>
        <div className="agent-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="agent-btn agent-btn--primary"
            onClick={run}
            disabled={pending || !input.trim()}
          >
            {pending ? "L'agent réfléchit…" : "Envoyer à l'agent"}
          </button>
        </div>

        {/* Réponse en cours */}
        {current ? (
          <div
            className={`agent-flash agent-flash--${current.ok ? "ok" : "err"}`}
            style={{
              marginTop: 22,
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            {current.output}
            {current.ok && current.duration_ms > 0 ? (
              <div style={{ marginTop: 12, fontSize: 11, opacity: 0.7, fontFamily: "inherit" }}>
                ⏱ {current.duration_ms} ms
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Historique */}
        {items.length > 0 ? (
          <>
            <h2 style={{ marginTop: 34 }}>Historique</h2>
            <div className="agent-pg-history">
              {items.slice(0, 10).map((m) => (
                <details key={m.id} className="agent-pg-turn">
                  <summary>
                    <span className={`agent-badge agent-badge--${m.success ? "installed" : "error"}`} style={{ padding: "3px 8px", fontSize: 9 }}>
                      {m.success ? "OK" : "ERR"}
                    </span>
                    <span className="agent-pg-turn__preview">
                      {m.input_text.slice(0, 100)}
                      {m.input_text.length > 100 ? "…" : ""}
                    </span>
                    <span className="agent-pg-turn__meta">
                      {new Date(m.created_at).toLocaleString("fr-FR")} · {m.duration_ms} ms
                    </span>
                  </summary>
                  <div className="agent-pg-turn__body">
                    <div className="agent-pg-turn__label">Question</div>
                    <pre>{m.input_text}</pre>
                    <div className="agent-pg-turn__label">
                      {m.success ? "Réponse" : "Erreur"}
                    </div>
                    <pre>{m.output_text || m.error_message}</pre>
                  </div>
                </details>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
