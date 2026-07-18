import { listDocumentsByType } from "../admin-actions";
import DocumentComposer from "./DocumentComposer";
import DocumentList from "./DocumentList";

type Props = {
  hasClaudeKey: boolean;
  hasYousignKey: boolean;
  hasAccountingKey: boolean;
  subTab: "quote" | "contract" | "invoice";
};

const TITLES = {
  quote: { plural: "Devis", singular: "devis" },
  contract: { plural: "Contrats", singular: "contrat" },
  invoice: { plural: "Factures", singular: "facture" },
};

export default async function AdminDocumentsView({
  hasClaudeKey,
  hasYousignKey,
  hasAccountingKey,
  subTab,
}: Props) {
  const [quotes, contracts, invoices] = await Promise.all([
    listDocumentsByType("quote", 50).catch(() => []),
    listDocumentsByType("contract", 50).catch(() => []),
    listDocumentsByType("invoice", 50).catch(() => []),
  ]);

  const currentDocs =
    subTab === "quote" ? quotes : subTab === "contract" ? contracts : invoices;
  const title = TITLES[subTab];

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* Sub-tabs */}
        <nav
          className="agent-tabs"
          role="tablist"
          style={{ marginBottom: 22 }}
        >
          {(["quote", "contract", "invoice"] as const).map((t) => (
            <a
              key={t}
              role="tab"
              aria-selected={subTab === t}
              href={`/admin/agents/admin?tab=documents&sub=${t}`}
              className={`agent-tab ${subTab === t ? "agent-tab--active" : ""}`}
            >
              {TITLES[t].plural} ({t === "quote" ? quotes.length : t === "contract" ? contracts.length : invoices.length})
            </a>
          ))}
        </nav>

        {/* KPIs */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>Vue d'ensemble</h2>
          <div className="agent-kpi-grid">
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{quotes.length}</div>
              <div className="agent-kpi__label">Devis</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{contracts.length}</div>
              <div className="agent-kpi__label">Contrats</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{invoices.length}</div>
              <div className="agent-kpi__label">Factures</div>
            </div>
            <div className="agent-kpi agent-kpi--ok">
              <div className="agent-kpi__value">
                {invoices.filter((i) => i.status === "paid").length}
              </div>
              <div className="agent-kpi__label">Payées</div>
            </div>
          </div>
        </div>

        {/* Composer */}
        {hasClaudeKey ? (
          <DocumentComposer
            kind={subTab}
            title={title.plural}
            singular={title.singular}
          />
        ) : (
          <div className="agent-panel" style={{ marginBottom: 22 }}>
            <div className="agent-flash agent-flash--err">
              Configurez d'abord votre clé API Anthropic et les informations
              légales dans l'onglet Configuration.
            </div>
          </div>
        )}

        {/* Liste */}
        <DocumentList
          docs={currentDocs}
          kind={subTab}
          hasYousignKey={hasYousignKey}
          hasAccountingKey={hasAccountingKey}
        />
      </div>
    </div>
  );
}
