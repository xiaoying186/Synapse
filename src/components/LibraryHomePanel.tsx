import type { LibraryHomePreview } from "../types";

type LibraryHomePanelProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  preview: LibraryHomePreview | null;
};

export function LibraryHomePanel({
  isRefreshing,
  onRefresh,
  preview,
}: LibraryHomePanelProps) {
  return (
    <section className="panel library-home-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Library home</p>
          <h3>Zhishu, backup, and recycle overview</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {preview ? (
        <>
          <div className="policy-tiers">
            <span>{preview.state}</span>
            <span>{preview.recycle_state}</span>
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>

          <div className="source-gate-list">
            <article className="source-gate-item">
              <div>
                <span>Zhishu memory</span>
                <strong>{preview.recent_memory_count}</strong>
              </div>
              <b>{preview.pending_review_count} pending</b>
              <small>Recent sampled items</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>Task outputs</span>
                <strong>{preview.recent_task_artifact_count}</strong>
              </div>
              <b>quarantined artifacts</b>
              <small>Promotion stays review-gated</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>Restore points</span>
                <strong>{preview.recent_backup_snapshot_count}</strong>
              </div>
              <b>protected snapshots</b>
              <small>Restore requires explicit review</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>Recycle candidates</span>
                <strong>{preview.recycle_candidate_count}</strong>
              </div>
              <b>{preview.recycle_state}</b>
              <small>Restore still requires explicit review</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>Saga recovery</span>
                <strong>{preview.active_saga_count}</strong>
              </div>
              <b>active or failed</b>
              <small>{preview.recent_sagas.length} recent transactions</small>
            </article>
          </div>

          <div className="retrieval-contract">
            <span>Recoverability policy</span>
            <strong>{preview.backup_library_policy}</strong>
            <p>{preview.restore_policy}</p>
            <small>{preview.recycle_policy}</small>
          </div>

          <div className="retrieval-contract">
            <span>Memory layers</span>
            <div className="policy-tiers">
              {preview.memory_by_level.length > 0 ? (
                preview.memory_by_level.map((metric) => (
                  <span key={metric.label}>
                    {metric.label}: {metric.value}
                  </span>
                ))
              ) : (
                <span>no memory items</span>
              )}
            </div>
            <span>Hub areas</span>
            <div className="policy-tiers">
              {preview.memory_by_area.length > 0 ? (
                preview.memory_by_area.map((metric) => (
                  <span key={metric.label}>
                    {metric.label}: {metric.value}
                  </span>
                ))
              ) : (
                <span>no hub areas</span>
              )}
            </div>
          </div>

          <div className="source-gate-list">
            {preview.recent_memory.slice(0, 4).map((item) => (
              <article className="source-gate-item" key={item.id}>
                <div>
                  <span>{item.level}</span>
                  <strong>{item.item_type}</strong>
                </div>
                <b>{item.admission_state}</b>
                <small>{item.content}</small>
              </article>
            ))}
            {preview.recent_task_artifacts.slice(0, 4).map((artifact) => (
              <article className="source-gate-item" key={artifact.id}>
                <div>
                  <span>{artifact.artifact_type}</span>
                  <strong>{artifact.title}</strong>
                </div>
                <b>{artifact.reference_id}</b>
                <small>{artifact.summary}</small>
              </article>
            ))}
            {preview.recent_snapshots.slice(0, 4).map((snapshot) => (
              <article className="source-gate-item" key={snapshot.id}>
                <div>
                  <span>{snapshot.object_type}</span>
                  <strong>{snapshot.object_id}</strong>
                </div>
                <b>v{snapshot.version}</b>
                <small>{snapshot.reason}</small>
              </article>
            ))}
            {preview.recycle_candidates.slice(0, 4).map((snapshot) => (
              <article className="source-gate-item" key={`recycle-${snapshot.id}`}>
                <div>
                  <span>Recycle preview</span>
                  <strong>{snapshot.object_id}</strong>
                </div>
                <b>{snapshot.object_type}</b>
                <small>{snapshot.reason}</small>
              </article>
            ))}
            {preview.recent_sagas.slice(0, 4).map((saga) => (
              <article className="source-gate-item" key={saga.id}>
                <div>
                  <span>{saga.kind}</span>
                  <strong>{saga.target_id}</strong>
                </div>
                <b>{saga.state}</b>
                <small>{saga.id}</small>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">Library projection is waiting for a local preview.</p>
      )}
    </section>
  );
}
