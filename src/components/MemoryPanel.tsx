import type { MemoryItem, SnapshotRecord } from "../types";
import { useI18n } from "../i18n";

type MemoryPanelProps = {
  items: MemoryItem[];
  onRollback: (snapshotId: string) => void;
  onReview: (memoryId: string, decision: "accepted" | "rejected") => void;
  rollingBackSnapshotId: string | null;
  reviewingItemId: string | null;
  snapshots: SnapshotRecord[];
};

export function MemoryPanel({
  items,
  onRollback,
  onReview,
  rollingBackSnapshotId,
  reviewingItemId,
  snapshots,
}: MemoryPanelProps) {
  const { text } = useI18n();
  const reviewableCount = items.filter(isReviewableMemoryItem).length;

  return (
    <section className="panel memory-panel" data-testid="zhishu-memory-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Zhishu memory")}</p>
          <h3>{text("Recent items")}</h3>
        </div>
        <strong>{reviewableCount} {text("pending")}</strong>
      </div>
      <div className="memory-list">
        {items.length === 0 && <span className="empty-state">{text("No memory items yet.")}</span>}
        {items.map((item) => {
          const admissionState = item.admission_state ?? item.verification;
          const canReview = isReviewableMemoryItem(item);

          return (
            <article className="memory-item" data-testid="zhishu-memory-item" key={item.id}>
              <div>
                <span>{text(item.scope)}</span>
                <strong>{item.content}</strong>
              </div>
              <small>
                {text(item.hub_area ?? "memory")} / {text(item.item_type)} / {text(item.level)} / {text(admissionState)}
              </small>
              <div className="memory-meta-grid">
                <span>{text("trust")}: {text(item.source_trust ?? "unverified-local")}</span>
                <span>{text("rule")}: {text(item.admission_rule ?? "manual-l0-capture")}</span>
                <span>{text("retention")}: {text(item.retention_policy ?? "session-review")}</span>
                <span>{text("authority")}: {text(item.authority ?? "user-reviewable")}</span>
              </div>
              {item.tags.length > 0 && (
                <div className="memory-tags">
                  {item.tags.map((tag) => (
                    <b key={tag}>{tag}</b>
                  ))}
                </div>
              )}
              {canReview && (
                <div className="memory-actions">
                  <button
                    type="button"
                    data-testid="accept-memory-candidate-button"
                    onClick={() => onReview(item.id, "accepted")}
                    disabled={reviewingItemId === item.id}
                  >
                    {text("Accept candidate")}
                  </button>
                  <button
                    type="button"
                    data-testid="reject-memory-candidate-button"
                    onClick={() => onReview(item.id, "rejected")}
                    disabled={reviewingItemId === item.id}
                  >
                    {text("Reject candidate")}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="memory-recovery">
        <div className="panel-heading compact-heading">
          <div>
            <p className="eyebrow">{text("Recovery")}</p>
            <h3>{text("Recent restore points")}</h3>
          </div>
          <strong>{snapshots.length} {text("saved")}</strong>
        </div>
        <div className="memory-recovery-list">
          {snapshots.length === 0 && <span className="empty-state">{text("No restore points yet.")}</span>}
          {snapshots.map((snapshot) => {
            const item = items.find((candidate) => candidate.id === snapshot.object_id);

            return (
              <div className="memory-recovery-row" key={snapshot.id}>
                <div>
                  <strong>{item?.content ?? snapshot.object_id}</strong>
                  <small>
                    v{snapshot.version} / {text(snapshot.reason)}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => onRollback(snapshot.id)}
                  disabled={rollingBackSnapshotId === snapshot.id}
                >
                  {text("Restore")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function isReviewableMemoryItem(item: MemoryItem) {
  const admissionState = item.admission_state ?? item.verification;
  const reviewableCandidate =
    item.level === "candidate" ||
    item.scope === "L2 Knowledge" ||
    item.retention_policy === "durable-review";

  return reviewableCandidate && admissionState !== "accepted" && admissionState !== "rejected";
}
