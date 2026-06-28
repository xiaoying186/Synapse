import type { MemoryItem, SnapshotRecord } from "../types";

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
  const reviewableCount = items.filter(isReviewableMemoryItem).length;

  return (
    <section className="panel memory-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Zhishu memory</p>
          <h3>Recent items</h3>
        </div>
        <strong>{reviewableCount} pending</strong>
      </div>
      <div className="memory-list">
        {items.length === 0 && <span className="empty-state">No memory items yet.</span>}
        {items.map((item) => {
          const admissionState = item.admission_state ?? item.verification;
          const canReview = isReviewableMemoryItem(item);

          return (
            <article className="memory-item" key={item.id}>
              <div>
                <span>{item.scope}</span>
                <strong>{item.content}</strong>
              </div>
              <small>
                {item.hub_area ?? "memory"} / {item.item_type} / {item.level} / {admissionState}
              </small>
              <div className="memory-meta-grid">
                <span>trust: {item.source_trust ?? "unverified-local"}</span>
                <span>rule: {item.admission_rule ?? "manual-l0-capture"}</span>
                <span>retention: {item.retention_policy ?? "session-review"}</span>
                <span>authority: {item.authority ?? "user-reviewable"}</span>
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
                    onClick={() => onReview(item.id, "accepted")}
                    disabled={reviewingItemId === item.id}
                  >
                    Accept candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview(item.id, "rejected")}
                    disabled={reviewingItemId === item.id}
                  >
                    Reject candidate
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
            <p className="eyebrow">Recovery</p>
            <h3>Recent restore points</h3>
          </div>
          <strong>{snapshots.length} saved</strong>
        </div>
        <div className="memory-recovery-list">
          {snapshots.length === 0 && <span className="empty-state">No restore points yet.</span>}
          {snapshots.map((snapshot) => {
            const item = items.find((candidate) => candidate.id === snapshot.object_id);

            return (
              <div className="memory-recovery-row" key={snapshot.id}>
                <div>
                  <strong>{item?.content ?? snapshot.object_id}</strong>
                  <small>
                    v{snapshot.version} / {snapshot.reason}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => onRollback(snapshot.id)}
                  disabled={rollingBackSnapshotId === snapshot.id}
                >
                  Restore
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
