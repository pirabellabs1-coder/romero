import { listDocumentsByType } from "../admin-actions";
import { getFinancialSnapshot, listContactsAction } from "../admin-crm-actions";
import DocumentComposer from "./DocumentComposer";
import DocumentList from "./DocumentList";
import AdminFinancialDashboard from "./AdminFinancialDashboard";
import AdminContactsView from "./AdminContactsView";

type SubTab = "quote" | "contract" | "invoice" | "clients";

type Props = {
  hasClaudeKey: boolean;
  hasYousignKey: boolean;
  hasAccountingKey: boolean;
  subTab: SubTab;
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
  const [quotes, contracts, invoices, snapshot, contacts] = await Promise.all([
    listDocumentsByType("quote", 50).catch(() => []),
    listDocumentsByType("contract", 50).catch(() => []),
    listDocumentsByType("invoice", 50).catch(() => []),
    getFinancialSnapshot().catch(() => null),
    listContactsAction(undefined, 200).catch(() => []),
  ]);

  const isDocTab = subTab === "quote" || subTab === "contract" || subTab === "invoice";
  const currentDocs =
    subTab === "quote"
      ? quotes
      : subTab === "contract"
      ? contracts
      : subTab === "invoice"
      ? invoices
      : [];
  const title = isDocTab ? TITLES[subTab as "quote" | "contract" | "invoice"] : null;

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* Dashboard financier — au top, visible partout */}
        {snapshot ? <AdminFinancialDashboard snapshot={snapshot} /> : null}

        {/* Sub-tabs */}
        <nav
          className="agent-tabs"
          role="tablist"
          style={{ marginBottom: 22 }}
        >
          {(["quote", "contract", "invoice", "clients"] as const).map((t) => (
            <a
              key={t}
              role="tab"
              aria-selected={subTab === t}
              href={`/admin/agents/admin?tab=documents&sub=${t}`}
              className={`agent-tab ${subTab === t ? "agent-tab--active" : ""}`}
            >
              {t === "quote"
                ? `Devis (${quotes.length})`
                : t === "contract"
                ? `Contrats (${contracts.length})`
                : t === "invoice"
                ? `Factures (${invoices.length})`
                : `Clients (${contacts.length})`}
            </a>
          ))}
        </nav>

        {/* ── Onglet Clients ── */}
        {subTab === "clients" ? (
          <AdminContactsView contacts={contacts} />
        ) : (
          <>
            {/* KPIs synthèse par type de doc */}
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
            {hasClaudeKey && title ? (
              <DocumentComposer
                kind={subTab as "quote" | "contract" | "invoice"}
                title={title.plural}
                singular={title.singular}
              />
            ) : !hasClaudeKey ? (
              <div className="agent-panel" style={{ marginBottom: 22 }}>
                <div className="agent-flash agent-flash--err">
                  Configurez d'abord votre clé API Anthropic et les informations
                  légales dans l'onglet Configuration.
                </div>
              </div>
            ) : null}

            {/* Liste */}
            {isDocTab ? (
              <DocumentList
                docs={currentDocs}
                kind={subTab as "quote" | "contract" | "invoice"}
                hasYousignKey={hasYousignKey}
                hasAccountingKey={hasAccountingKey}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
