import type {
  ZhishuMaintenanceFinding,
  ZhishuRelationRecord,
  ZhishuRepositoryImportReceipt,
  ZhishuSearchQuery,
  ZhishuSearchResponse,
} from "../types";

type ZhishuSearchPanelProps = {
  isGeneratingRelations: boolean;
  isImportingRepository: boolean;
  isScanningMaintenance: boolean;
  isSearching: boolean;
  maintenanceFindings: ZhishuMaintenanceFinding[];
  onGenerateRelations: () => void;
  onExportRepository: () => void;
  onImportRepository: () => void;
  onQueryChange: (query: ZhishuSearchQuery) => void;
  onReviewMaintenanceFinding: (
    findingId: string,
    decision: "accepted" | "rejected",
  ) => void;
  onReviewRelation: (relationId: string, decision: "accepted" | "rejected") => void;
  onScanMaintenance: () => void;
  onSearch: () => void;
  onRepositoryBundleChange: (value: string) => void;
  query: ZhishuSearchQuery;
  repositoryBundle: string;
  repositoryImportReceipt: ZhishuRepositoryImportReceipt | null;
  relations: ZhishuRelationRecord[];
  response: ZhishuSearchResponse | null;
  reviewingMaintenanceFindingId: string | null;
  reviewingRelationId: string | null;
};

export function ZhishuSearchPanel({
  isGeneratingRelations,
  isImportingRepository,
  isScanningMaintenance,
  isSearching,
  maintenanceFindings,
  onGenerateRelations,
  onExportRepository,
  onImportRepository,
  onQueryChange,
  onReviewMaintenanceFinding,
  onReviewRelation,
  onScanMaintenance,
  onSearch,
  onRepositoryBundleChange,
  query,
  repositoryBundle,
  repositoryImportReceipt,
  relations,
  response,
  reviewingMaintenanceFindingId,
  reviewingRelationId,
}: ZhishuSearchPanelProps) {
  function update<K extends keyof ZhishuSearchQuery>(key: K, value: ZhishuSearchQuery[K]) {
    onQueryChange({ ...query, [key]: value });
  }

  return (
    <section className="panel zhishu-search-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Zhishu retrieval</p>
          <h3>Search, relations, and maintenance</h3>
        </div>
        <strong>{response?.total_matches ?? 0} matches</strong>
      </div>
      <form
        className="zhishu-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <input
          value={query.text}
          onChange={(event) => update("text", event.target.value)}
          placeholder="Search content, tags, type, or hub area"
        />
        <input
          value={query.hub_area ?? ""}
          onChange={(event) => update("hub_area", event.target.value || null)}
          placeholder="Hub area"
        />
        <input
          value={query.item_type ?? ""}
          onChange={(event) => update("item_type", event.target.value || null)}
          placeholder="Item type"
        />
        <select
          value={query.scope ?? ""}
          onChange={(event) => update("scope", event.target.value || null)}
        >
          <option value="">Any scope</option>
          <option value="L0 Session">L0 Session</option>
          <option value="L1 Working">L1 Working</option>
          <option value="L2 Knowledge">L2 Knowledge</option>
        </select>
        <select
          value={query.admission_state ?? ""}
          onChange={(event) => update("admission_state", event.target.value || null)}
        >
          <option value="">Any admission</option>
          <option value="captured">Captured</option>
          <option value="accepted">Accepted</option>
        </select>
        <input
          type="number"
          min="0"
          max="100"
          value={Math.round((query.minimum_confidence ?? 0) * 100)}
          onChange={(event) =>
            update("minimum_confidence", Number(event.target.value) / 100)
          }
          aria-label="Minimum confidence percent"
        />
        <input
          type="number"
          min="1"
          value={query.max_age_days ?? ""}
          onChange={(event) =>
            update("max_age_days", event.target.value ? Number(event.target.value) : null)
          }
          placeholder="Max age days"
        />
        <button type="submit" disabled={isSearching}>
          {isSearching ? "Searching" : "Search"}
        </button>
        <button type="button" onClick={onGenerateRelations} disabled={isGeneratingRelations}>
          {isGeneratingRelations ? "Linking" : "Suggest links"}
        </button>
        <button type="button" onClick={onScanMaintenance} disabled={isScanningMaintenance}>
          {isScanningMaintenance ? "Scanning" : "Scan maintenance"}
        </button>
      </form>
      <div className="zhishu-search-results">
        {(response?.results ?? []).map((result) => (
          <article className="zhishu-search-result" key={result.item.id}>
            <div>
              <span>
                {result.item.hub_area} / {result.item.item_type} / {result.item.scope}
              </span>
              <strong>{result.item.content}</strong>
              <p>{result.explanation}</p>
            </div>
            <b>{Math.round(result.score * 100)}%</b>
            <small>{result.matched_fields.join(", ")}</small>
          </article>
        ))}
      </div>
      <div className="zhishu-relation-list">
        {relations.map((relation) => (
          <article className="zhishu-relation-item" key={relation.id}>
            <div>
              <span>{relation.relation_type}</span>
              <strong>
                {relation.source_memory_id} to {relation.target_memory_id}
              </strong>
              <p>{relation.reason}</p>
              <small>{relation.evidence.join(", ")}</small>
            </div>
            <b>{relation.review_state}</b>
            {relation.review_state === "candidate" && (
              <div className="memory-actions">
                <button
                  type="button"
                  disabled={reviewingRelationId === relation.id}
                  onClick={() => onReviewRelation(relation.id, "accepted")}
                >
                  Accept link
                </button>
                <button
                  type="button"
                  disabled={reviewingRelationId === relation.id}
                  onClick={() => onReviewRelation(relation.id, "rejected")}
                >
                  Reject link
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="zhishu-maintenance-list">
        {maintenanceFindings.map((finding) => (
          <article
            className={`zhishu-maintenance-item severity-${finding.severity}`}
            key={finding.id}
          >
            <div>
              <span>
                {finding.finding_kind} / {finding.severity}
              </span>
              <strong>{finding.item_ids.join(" + ")}</strong>
              <p>{finding.reason}</p>
              <small>{finding.evidence.join(" | ")}</small>
            </div>
            <b>{finding.review_state}</b>
            {finding.review_state === "candidate" && (
              <div className="memory-actions">
                <button
                  type="button"
                  disabled={reviewingMaintenanceFindingId === finding.id}
                  onClick={() => onReviewMaintenanceFinding(finding.id, "accepted")}
                >
                  Accept finding
                </button>
                <button
                  type="button"
                  disabled={reviewingMaintenanceFindingId === finding.id}
                  onClick={() => onReviewMaintenanceFinding(finding.id, "rejected")}
                >
                  Reject finding
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="zhishu-repository-tools">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Repository backup</p>
            <h3>Versioned JSON bundle</h3>
          </div>
          {repositoryImportReceipt && (
            <strong>
              {repositoryImportReceipt.memory_items} / {repositoryImportReceipt.relations} /{" "}
              {repositoryImportReceipt.maintenance_findings}
            </strong>
          )}
        </div>
        <textarea
          value={repositoryBundle}
          onChange={(event) => onRepositoryBundleChange(event.target.value)}
          placeholder="Export a bundle or paste a compatible Zhishu repository bundle"
        />
        <div className="memory-actions">
          <button type="button" onClick={onExportRepository}>
            Export JSON
          </button>
          <button
            type="button"
            disabled={isImportingRepository || !repositoryBundle.trim()}
            onClick={onImportRepository}
          >
            {isImportingRepository ? "Importing" : "Import and replace"}
          </button>
        </div>
      </div>
    </section>
  );
}
