import { displayFrequency } from "../format";
import { useI18n } from "../i18n";
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
  const { text } = useI18n();
  const scheduleByDirection = new Map(
    schedulePreviews.map((preview) => [preview.direction_id, preview]),
  );

  return (
    <section className="panel task-center-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Priority map")}</p>
          <h3>{text("Active directions")}</h3>
        </div>
        <button className="text-action" type="button" onClick={onMine} disabled={isMining}>
          {isMining ? text("Mining") : text("Mine")}
        </button>
      </div>
      <div className="direction-list">
        {directions.length === 0 && <span className="empty-state">{text("No task directions yet.")}</span>}
        {directions.map((direction) => (
          <article className="direction-item" data-testid="direction-item" key={direction.id}>
            {(() => {
              const schedule = scheduleByDirection.get(direction.id);

              return schedule ? (
                <div className="direction-schedule">
                  <span>{text(schedule.readiness)}</span>
                  <strong>{schedule.next_run_label}</strong>
                  <small>{text(schedule.detail)}</small>
                  <small>
                    {schedule.push_enabled
                      ? `${text("push")}: ${(schedule.push_channels ?? []).join(", ") || text("configured")}`
                      : text("no push")}
                  </small>
                  {schedule.next_run_at_ms && (
                    <small>{text("next")}: {new Date(schedule.next_run_at_ms).toLocaleString()}</small>
                  )}
                </div>
              ) : null;
            })()}
            <div>
              <span>{text("Priority")} {direction.priority}</span>
              <strong>{direction.title}</strong>
              {direction.description && <p>{direction.description}</p>}
            </div>
            <div className="direction-meta">
              <span className={direction.active ? "direction-state-active" : "direction-state-inactive"}>
                {text(direction.active ? "active" : "inactive")}
              </span>
              <span>{text(displayFrequency(direction.schedule_frequency))}</span>
              <span>{text(direction.output_template ?? "auto")}</span>
              <span>{text(direction.online_enabled ? "online" : "local")}</span>
              <span>
                {direction.push_enabled
                  ? `${text("push")}: ${(direction.push_channels ?? []).join(", ") || text("configured")}`
                  : text("no push")}
              </span>
            </div>
            <button
              className="text-action"
              data-testid="request-task-run-button"
              type="button"
              onClick={() => onRequestRun(direction.id)}
              disabled={requestingDirectionId === direction.id || !direction.active}
            >
              {requestingDirectionId === direction.id ? text("Recording") : text("Request run")}
            </button>
            <button
              className="text-action"
              type="button"
              onClick={() => onSetActive(direction.id, !direction.active)}
              disabled={updatingDirectionId === direction.id}
            >
              {updatingDirectionId === direction.id
                ? text("Updating")
                : direction.active
                  ? text("Disable")
                  : text("Enable")}
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
