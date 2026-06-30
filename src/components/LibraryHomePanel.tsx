import type { LibraryHomePreview } from "../types";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();

  return (
    <section className="panel library-home-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("library.eyebrow")}</p>
          <h3>{t("library.title")}</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? t("library.refreshing") : t("library.refresh")}
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
                <span>{t("library.zhishuMemory")}</span>
                <strong>{preview.recent_memory_count}</strong>
              </div>
              <b>{preview.pending_review_count} {t("library.pending")}</b>
              <small>{t("library.recentSampledItems")}</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>{t("library.taskOutputs")}</span>
                <strong>{preview.recent_task_artifact_count}</strong>
              </div>
              <b>{t("library.quarantinedArtifacts")}</b>
              <small>{t("library.promotionReviewGated")}</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>{t("library.restorePoints")}</span>
                <strong>{preview.recent_backup_snapshot_count}</strong>
              </div>
              <b>{t("library.protectedSnapshots")}</b>
              <small>{t("library.restoreRequiresReview")}</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>{t("library.recycleCandidates")}</span>
                <strong>{preview.recycle_candidate_count}</strong>
              </div>
              <b>{preview.recycle_state}</b>
              <small>{t("library.restoreRequiresReview")}</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>{t("library.sagaRecovery")}</span>
                <strong>{preview.active_saga_count}</strong>
              </div>
              <b>{t("library.activeOrFailed")}</b>
              <small>{preview.recent_sagas.length} {t("library.recentTransactions")}</small>
            </article>
          </div>

          <div className="retrieval-contract">
            <span>{t("library.recoverabilityPolicy")}</span>
            <strong>{preview.backup_library_policy}</strong>
            <p>{preview.restore_policy}</p>
            <small>{preview.recycle_policy}</small>
          </div>

          <div className="retrieval-contract">
            <span>{t("library.memoryLayers")}</span>
            <div className="policy-tiers">
              {preview.memory_by_level.length > 0 ? (
                preview.memory_by_level.map((metric) => (
                  <span key={metric.label}>
                    {metric.label}: {metric.value}
                  </span>
                ))
              ) : (
                <span>{t("library.noMemoryItems")}</span>
              )}
            </div>
            <span>{t("library.hubAreas")}</span>
            <div className="policy-tiers">
              {preview.memory_by_area.length > 0 ? (
                preview.memory_by_area.map((metric) => (
                  <span key={metric.label}>
                    {metric.label}: {metric.value}
                  </span>
                ))
              ) : (
                <span>{t("library.noHubAreas")}</span>
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
                  <span>{t("library.recyclePreview")}</span>
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
        <p className="empty-state">{t("library.empty")}</p>
      )}
    </section>
  );
}
