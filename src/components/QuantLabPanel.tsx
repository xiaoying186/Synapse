import { useState } from "react";
import { useI18n } from "../i18n";
import type { QuantResearchReport, StrategyConfig, TaskRunRecord } from "../types";

type QuantLabPanelProps = {
  isArchiving: boolean;
  isResearching: boolean;
  onArchive: (runId: string, csv: string, config: StrategyConfig) => void;
  onResearch: (csv: string, config: StrategyConfig) => void;
  report: QuantResearchReport | null;
  runs: TaskRunRecord[];
};

export function QuantLabPanel({
  isArchiving,
  isResearching,
  onArchive,
  onResearch,
  report,
  runs,
}: QuantLabPanelProps) {
  const { text } = useI18n();
  const [name, setName] = useState("MA crossover research");
  const [shortWindow, setShortWindow] = useState(5);
  const [longWindow, setLongWindow] = useState(20);
  const [csv, setCsv] = useState("date,close\n");
  const [runId, setRunId] = useState("");
  const config = (): StrategyConfig => ({
    name,
    short_window: shortWindow,
    long_window: longWindow,
  });
  const approvedRuns = runs.filter(
    (run) =>
      run.lifecycle_state === "approved" &&
      run.approval_state === "approved" &&
      run.execution_state === "approved-not-started",
  );
  const percent = (value?: number | null) =>
    value == null ? "n/a" : `${(value * 100).toFixed(2)}%`;

  return (
    <section className="panel quant-lab-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Domain pilot")}</p>
          <h3>{text("A-share strategy laboratory")}</h3>
        </div>
        <strong>{text(report?.state ?? "research only")}</strong>
      </div>
      <div className="quant-config">
        <input value={name} onChange={(event) => setName(event.target.value)} />
        <label>
          {text("Short")}
          <input
            type="number"
            min="2"
            max="249"
            value={shortWindow}
            onChange={(event) => setShortWindow(Number(event.target.value))}
          />
        </label>
        <label>
          {text("Long")}
          <input
            type="number"
            min="3"
            max="250"
            value={longWindow}
            onChange={(event) => setLongWindow(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={isResearching || !csv.trim()}
          onClick={() => onResearch(csv, config())}
        >
          {isResearching ? text("Simulating") : text("Run simulation")}
        </button>
      </div>
      <textarea
        className="quant-csv"
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        placeholder="date,close"
      />
      {report && (
        <div className="quant-report">
          <span>{report.strategy_version}</span>
          <strong>{report.sample_count} {text("samples")}</strong>
          <b>{text("Strategy")} {percent(report.strategy_return)}</b>
          <b>{text("Benchmark")} {percent(report.benchmark_return)}</b>
          <b>{text("Drawdown")} {percent(report.max_drawdown)}</b>
          <small>{report.warnings.join(" | ")}</small>
          <small>{report.disclaimer}</small>
        </div>
      )}
      <div className="daily-briefing-archive">
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">{text("Select approved Task Run")}</option>
          {approvedRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isArchiving || !runId || report?.state !== "research-ready"}
          onClick={() => onArchive(runId, csv, config())}
        >
          {isArchiving ? text("Archiving") : text("Archive research")}
        </button>
      </div>
    </section>
  );
}
