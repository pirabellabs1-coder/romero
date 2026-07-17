"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { installAgent, pauseAgent, uninstallAgent } from "../actions";
import type { AgentStatus } from "@/lib/agents";

type Props = {
  slug: string;
  status: AgentStatus;
};

export default function AgentStatusControls({ slug, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok && "error" in res) setErr(res.error!);
      router.refresh();
    });
  }

  return (
    <div>
      {err ? (
        <div className="agent-flash agent-flash--err" role="alert">
          ✗ {err}
        </div>
      ) : null}
      <div className="agent-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        {status !== "installed" ? (
          <button
            type="button"
            className="agent-btn agent-btn--primary"
            disabled={pending}
            onClick={() => run(() => installAgent(slug))}
          >
            {pending ? "…" : "Marquer comme installé"}
          </button>
        ) : (
          <button
            type="button"
            className="agent-btn agent-btn--ghost"
            disabled={pending}
            onClick={() => run(() => pauseAgent(slug))}
          >
            {pending ? "…" : "Mettre en pause"}
          </button>
        )}
        {status !== "not_installed" ? (
          <button
            type="button"
            className="agent-btn agent-btn--danger"
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  "Désinstaller l'agent ? Les paramètres restent enregistrés mais l'agent sera stoppé."
                )
              ) {
                run(() => uninstallAgent(slug));
              }
            }}
          >
            {pending ? "…" : "Désinstaller"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
