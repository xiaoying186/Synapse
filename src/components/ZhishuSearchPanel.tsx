import type {
  ZhishuMaintenanceFinding,
  ZhishuRelationRecord,
  ZhishuRepositoryImportReceipt,
  ZhishuSearchQuery,
  ZhishuSearchResponse,
} from "../types";
import { useI18n } from "../i18n";

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
  const { text } = useI18n();

  function update<K extends keyof ZhishuSearchQuery>(key: K, value: ZhishuSearchQuery[K]) {
    onQueryChange({ ...query, [key]: value });
  }

  return (
    <section className="panel zhishu-search-panel" data-testid="zhishu-search-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Zhishu retrieval")}</p>
          <h3>{text("Search, relations, and maintenance")}</h3>
        </div>
        <strong>{response?.total_matches ?? 0} {text("matches")}</strong>
      </div>
      <form
        className="zhishu-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <input
          data-testid="zhishu-search-input"
          value={query.text}
          onChange={(event) => update("text", event.target.value)}
          placeholder={text("Search content, tags, type, or hub area")}
        />
        <input
          value={query.hub_area ?? ""}
          onChange={(event) => update("hub_area", event.target.value || null)}
          placeholder={text("Hub area")}
        />
        <input
          value={query.item_type ?? ""}
          onChange={(event) => update("item_type", event.target.value || null)}
          placeholder={text("Item type")}
        />
        <select
          data-testid="zhishu-search-scope-select"
          value={query.scope ?? ""}
          onChange={(event) => update("scope", event.target.value || null)}
        >
          <option value="">{text("Any scope")}</option>
          <option value="L0 Session">{text("L0 Session")}</option>
          <option value="L1 Working">{text("L1 Working")}</option>
          <option value="L2 Knowledge">{text("L2 Knowledge")}</option>
        </select>
        <select
          data-testid="zhishu-search-admission-select"
          value={query.admission_state ?? ""}
          onChange={(event) => update("admission_state", event.target.value || null)}
        >
          <option value="">{text("Any admission")}</option>
          <option value="captured">{text("Captured")}</option>
          <option value="accepted">{text("Accepted")}</option>
        </select>
        <input
          type="number"
          min="0"
          max="100"
          value={Math.round((query.minimum_confidence ?? 0) * 100)}
          onChange={(event) =>
            update("minimum_confidence", Number(event.target.value) / 100)
          }
          aria-label={text("Minimum confidence percent")}
        />
        <input
          type="number"
          min="1"
          value={query.max_age_days ?? ""}
          onChange={(event) =>
            update("max_age_days", event.target.value ? Number(event.target.value) : null)
          }
          placeholder={text("Max age days")}
        />
        <button type="submit" data-testid="zhishu-search-button" disabled={isSearching}>
          {isSearching ? text("Searching") : text("Search")}
        </button>
        <button type="button" onClick={onGenerateRelations} disabled={isGeneratingRelations}>
          {isGeneratingRelations ? text("Linking") : text("Suggest links")}
        </button>
        <button type="button" onClick={onScanMaintenance} disabled={isScanningMaintenance}>
          {isScanningMaintenance ? text("Scanning") : text("Scan maintenance")}
        </button>
      </form>
      <div className="zhishu-search-results" data-testid="zhishu-search-results">
        {(response?.results ?? []).map((result) => (
          <article className="zhishu-search-result" data-testid="zhishu-search-result" key={result.item.id}>
            <div>
              <span>
                {text(result.item.hub_area)} / {text(result.item.item_type)} / {text(result.item.scope)}
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
              <span>{text(relation.relation_type)}</span>
              <strong>
                {relation.source_memory_id} {text("to")} {relation.target_memory_id}
              </strong>
              <p>{relation.reason}</p>
              <small>{relation.evidence.join(", ")}</small>
            </div>
            <b>{text(relation.review_state)}</b>
            {relation.review_state === "candidate" && (
              <div className="memory-actions">
                <button
                  type="button"
                  disabled={reviewingRelationId === relation.id}
                  onClick={() => onReviewRelation(relation.id, "accepted")}
                >
                  {text("Accept link")}
                </button>
                <button
                  type="button"
                  disabled={reviewingRelationId === relation.id}
                  onClick={() => onReviewRelation(relation.id, "rejected")}
                >
                  {text("Reject link")}
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
                {text(finding.finding_kind)} / {text(finding.severity)}
              </span>
              <strong>{finding.item_ids.join(" + ")}</strong>
              <p>{finding.reason}</p>
              <small>{finding.evidence.join(" | ")}</small>
            </div>
            <b>{text(finding.review_state)}</b>
            {finding.review_state === "candidate" && (
              <div className="memory-actions">
                <button
                  type="button"
                  disabled={reviewingMaintenanceFindingId === finding.id}
                  onClick={() => onReviewMaintenanceFinding(finding.id, "accepted")}
                >
                  {text("Accept finding")}
                </button>
                <button
                  type="button"
                  disabled={reviewingMaintenanceFindingId === finding.id}
                  onClick={() => onReviewMaintenanceFinding(finding.id, "rejected")}
                >
                  {text("Reject finding")}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="zhishu-repository-tools">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{text("Repository backup")}</p>
            <h3>{text("Versioned JSON bundle")}</h3>
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
          placeholder={text("Export a bundle or paste a compatible Zhishu repository bundle")}
        />
        <div className="memory-actions">
          <button type="button" onClick={onExportRepository}>
            {text("Export JSON")}
          </button>
          <button
            type="button"
            disabled={isImportingRepository || !repositoryBundle.trim()}
            onClick={onImportRepository}
          >
            {isImportingRepository ? text("Importing") : text("Import and replace")}
          </button>
        </div>
      </div>
    </section>
  );
}
