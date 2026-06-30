import type { SourceRegistryPreview } from "../types";

type SourceRegistryPanelProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  preview: SourceRegistryPreview | null;
};

export function SourceRegistryPanel({
  isRefreshing,
  onRefresh,
  preview,
}: SourceRegistryPanelProps) {
  return (
    <section className="panel source-registry-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Baigong / Taiheng</p>
          <h3>Data Source Registry</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {preview ? (
        <>
          <div className="retrieval-contract">
            <span>{preview.state}</span>
            <strong>{preview.registry_scope}</strong>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{gate}</span>
              ))}
            </div>
            <small>Denied: {preview.denied_actions.join(", ")}</small>
          </div>

          <div className="source-gate-list">
            {preview.entries.map((entry) => (
              <article className="source-gate-item" key={entry.source_id}>
                <div>
                  <span>{entry.status}</span>
                  <strong>{entry.name}</strong>
                </div>
                <b>{entry.owner_module}</b>
                <small>
                  {entry.type} / {entry.scope} / {entry.storage_policy}
                </small>
                <small>
                  adapter: {entry.adapter_kind} / observation: {entry.observation_policy}
                </small>
                <em>
                  enabled: {entry.enabled ? "true" : "false"}; auth:{" "}
                  {entry.auth_required ? "required" : "none"}; health:{" "}
                  {entry.health_check_policy}; freshness: {entry.freshness_policy}
                </em>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">Data source registry preview has not been loaded yet.</p>
      )}
    </section>
  );
}
