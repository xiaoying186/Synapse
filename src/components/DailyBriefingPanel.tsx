import { useState } from "react";
import type {
  DailyBriefingPreview,
  DailyBriefingTemplate,
  TaskRunRecord,
} from "../types";

type DailyBriefingPanelProps = {
  isArchiving: boolean;
  isPreviewing: boolean;
  onArchive: (runId: string, template: DailyBriefingTemplate) => void;
  onPreview: (template: DailyBriefingTemplate) => void;
  preview: DailyBriefingPreview | null;
  runs: TaskRunRecord[];
};

export function DailyBriefingPanel({
  isArchiving,
  isPreviewing,
  onArchive,
  onPreview,
  preview,
  runs,
}: DailyBriefingPanelProps) {
  const [title, setTitle] = useState("Daily intelligence brief");
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState(
    "Key developments\nRisks and uncertainty\nSuggested follow-ups",
  );
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [runId, setRunId] = useState("");
  const approvedRuns = runs.filter(
    (run) =>
      run.lifecycle_state === "approved" &&
      run.approval_state === "approved" &&
      run.execution_state === "approved-not-started",
  );
  const template = (): DailyBriefingTemplate => ({
    title,
    query,
    sections: sections.split("\n").map((value) => value.trim()).filter(Boolean),
    online_enabled: onlineEnabled,
  });

  return (
    <section className="panel daily-briefing-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Domain pilot</p>
          <h3>Daily briefing</h3>
        </div>
        <strong>{preview?.archive_gate ?? "not previewed"}</strong>
      </div>
      <div className="daily-briefing-form">
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Briefing topic or monitoring query"
        />
        <textarea
          value={sections}
          onChange={(event) => setSections(event.target.value)}
          placeholder="One section per line"
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={onlineEnabled}
            onChange={(event) => setOnlineEnabled(event.target.checked)}
          />
          <span>Request online evidence</span>
        </label>
        <button type="button" disabled={isPreviewing || !query.trim()} onClick={() => onPreview(template())}>
          {isPreviewing ? "Previewing" : "Preview briefing"}
        </button>
      </div>
      {preview && <pre className="daily-briefing-preview">{preview.rendered_markdown}</pre>}
      <div className="daily-briefing-archive">
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Select approved Task Run</option>
          {approvedRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isArchiving || !runId || !preview || preview.archive_gate !== "reviewable"}
          onClick={() => onArchive(runId, template())}
        >
          {isArchiving ? "Archiving" : "Archive to run"}
        </button>
      </div>
    </section>
  );
}
