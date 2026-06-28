import { displayFrequency } from "../format";
import type { TaskDirection, TaskSchedulePreview } from "../types";

type DirectionListPanelProps = {
  directions: TaskDirection[];
  isMining: boolean;
  onMine: () => void;
  onRequestRun: (directionId: string) => void;
  onSetActive: (directionId: string, active: boolean) => void;
  requestingDirectionId: string | null;
  schedulePreviews: TaskSchedulePreview[];
  updatingDirectionId: string | null;
};

export function DirectionListPanel({
  directions,
  isMining,
  onMine,
  onRequestRun,
  onSetActive,
  requestingDirectionId,
  schedulePreviews,
  updatingDirectionId,
}: DirectionListPanelProps) {
  const scheduleByDirection = new Map(
    schedulePreviews.map((preview) => [preview.direction_id, preview]),
  );

  return (
    <section className="panel task-center-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Priority map</p>
          <h3>Active directions</h3>
        </div>
        <button className="text-action" type="button" onClick={onMine} disabled={isMining}>
          {isMining ? "Mining" : "Mine"}
        </button>
      </div>
      <div className="direction-list">
        {directions.length === 0 && <span className="empty-state">No task directions yet.</span>}
        {directions.map((direction) => (
          <article className="direction-item" key={direction.id}>
            {(() => {
              const schedule = scheduleByDirection.get(direction.id);

              return schedule ? (
                <div className="direction-schedule">
                  <span>{schedule.readiness}</span>
                  <strong>{schedule.next_run_label}</strong>
                  <small>{schedule.detail}</small>
                  <small>
                    {schedule.push_enabled
                      ? `push: ${(schedule.push_channels ?? []).join(", ") || "configured"}`
                      : "no push"}
                  </small>
                  {schedule.next_run_at_ms && (
                    <small>next: {new Date(schedule.next_run_at_ms).toLocaleString()}</small>
                  )}
                </div>
              ) : null;
            })()}
            <div>
              <span>Priority {direction.priority}</span>
              <strong>{direction.title}</strong>
              {direction.description && <p>{direction.description}</p>}
            </div>
            <div className="direction-meta">
              <span className={direction.active ? "direction-state-active" : "direction-state-inactive"}>
                {direction.active ? "active" : "inactive"}
              </span>
              <span>{displayFrequency(direction.schedule_frequency)}</span>
              <span>{direction.output_template ?? "auto"}</span>
              <span>{direction.online_enabled ? "online" : "local"}</span>
              <span>
                {direction.push_enabled
                  ? `push: ${(direction.push_channels ?? []).join(", ") || "configured"}`
                  : "no push"}
              </span>
            </div>
            <button
              className="text-action"
              type="button"
              onClick={() => onRequestRun(direction.id)}
              disabled={requestingDirectionId === direction.id || !direction.active}
            >
              {requestingDirectionId === direction.id ? "Recording" : "Request run"}
            </button>
            <button
              className="text-action"
              type="button"
              onClick={() => onSetActive(direction.id, !direction.active)}
              disabled={updatingDirectionId === direction.id}
            >
              {updatingDirectionId === direction.id
                ? "Updating"
                : direction.active
                  ? "Disable"
                  : "Enable"}
            </button>
            {direction.keywords.length > 0 && (
              <div className="memory-tags">
                {direction.keywords.map((keyword) => (
                  <b key={keyword}>{keyword}</b>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
