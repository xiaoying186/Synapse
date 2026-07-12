import { useI18n } from "../i18n";
import { useState } from "react";
import type { SkillLibraryPreview, SkillScriptExecutionPreflight, SkillScriptExecutionReceipt, SkillScriptExecutionRequest, TaskRunRecord } from "../types";

type SkillLibraryPanelProps = {
  isPreflightingScript: boolean;
  isExecutingScript: boolean;
  isPreviewing: boolean;
  onPreflightScript: (request: SkillScriptExecutionRequest) => void;
  onExecuteScript: (request: SkillScriptExecutionRequest) => void;
  onPreview: () => void;
  preview: SkillLibraryPreview | null;
  scriptPreflight: SkillScriptExecutionPreflight | null;
  scriptReceipt: SkillScriptExecutionReceipt | null;
  runs: TaskRunRecord[];
};

export function SkillLibraryPanel({
  isPreflightingScript,
  isExecutingScript,
  isPreviewing,
  onPreflightScript,
  onExecuteScript,
  onPreview,
  preview,
  scriptPreflight,
  scriptReceipt,
  runs,
}: SkillLibraryPanelProps) {
  const { text } = useI18n();
  const scriptSkillId =
    preview?.manifests.find((manifest) => manifest.script_adapter !== "none")?.skill_id ??
    "script.safe-system-inventory";
  const [runId, setRunId] = useState("");
  const request = (): SkillScriptExecutionRequest => ({ skill_id: scriptSkillId, run_id: runId });
  const canExecute = scriptPreflight?.state === "ready-for-explicit-script-execution-approval"
    && scriptPreflight.run_id === runId
    && scriptPreflight.skill_id === scriptSkillId;

  return (
    <section className="panel skill-library-panel" data-testid="skill-library-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Skill library")}</p>
          <h3>{text("Versioned skill and script manifest preview")}</h3>
        </div>
        <div className="panel-actions">
          <select data-testid="skill-script-run-select" value={runId} onChange={(event) => setRunId(event.target.value)}>
            <option value="">{text("Select Task Run")}</option>
            {runs.map((run) => <option key={run.id} value={run.id}>{run.task_direction_title} / {text(run.approval_state)}</option>)}
          </select>
          <button
            type="button"
            data-testid="skill-library-preview-button"
            onClick={onPreview}
            disabled={isPreviewing}
          >
            {isPreviewing ? text("Previewing") : text("Preview")}
          </button>
          <button
            type="button"
            data-testid="skill-script-execution-preflight-button"
            onClick={() => onPreflightScript(request())}
            disabled={isPreflightingScript || !runId}
          >
            {isPreflightingScript
              ? text("Checking script execution")
              : text("Check script execution gates")}
          </button>
          <button
            type="button"
            data-testid="skill-script-execution-button"
            onClick={() => onExecuteScript(request())}
            disabled={isExecutingScript || !canExecute}
          >
            {isExecutingScript ? text("Executing script") : text("Execute guarded script")}
          </button>
        </div>
      </div>

      {scriptPreflight && (
        <div className="retrieval-contract" data-testid="skill-script-execution-preflight-result">
          <span>{text(scriptPreflight.state)}</span>
          <strong>
            {text("Script execution is blocked by default")} / {text(scriptPreflight.skill_id)}
          </strong>
          <p>
            {text("process started")}: {text(scriptPreflight.process_started ? "true" : "false")} /{" "}
            {text("script content read")}:{" "}
            {text(scriptPreflight.script_content_read ? "true" : "false")} /{" "}
            {text("durable Zhishu write")}:{" "}
            {text(scriptPreflight.durable_zhishu_write ? "true" : "false")}
          </p>
          <p>
            {text("script path allowlisted")}: {text(scriptPreflight.script_path_allowlisted ? "true" : "false")} / {text("script hash verified")}: {text(scriptPreflight.script_hash_verified ? "true" : "false")} / {text("executor enabled")}: {text(scriptPreflight.executor_enabled ? "true" : "false")}
          </p>
          <code>{scriptPreflight.actual_sha256 || scriptPreflight.expected_sha256}</code>
          <p>
            {text("filesystem mutation started")}:{" "}
            {text(scriptPreflight.filesystem_mutation_started ? "true" : "false")} /{" "}
            {text("network call started")}:{" "}
            {text(scriptPreflight.network_call_started ? "true" : "false")}
          </p>
          <div className="policy-tiers">
            {scriptPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blockers")}: {scriptPreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
          <small>
            {text("Denied")}: {scriptPreflight.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {scriptReceipt && (
        <div className="task-run-result" data-testid="skill-script-execution-receipt">
          <span>{text(scriptReceipt.state)} / {text("exit code")}: {scriptReceipt.exit_code}</span>
          <strong>{scriptReceipt.artifact.title}</strong>
          <small>{text("output hash")}: {scriptReceipt.output_sha256}</small>
          <small>{text("Snapshot")}: {scriptReceipt.rollback_snapshot.id} / {text("Audit event")}: {scriptReceipt.audit_event.id} / {text("Saga")}: {text(scriptReceipt.saga.state)}</small>
        </div>
      )}

      {preview ? (
        <>
          <div className="retrieval-contract" data-testid="skill-library-preview-result">
            <span>{text(preview.state)}</span>
            <strong>
              {preview.manifests.length} {text("manifests")} / {preview.execution_contracts.length}{" "}
              {text("execution contracts")}
            </strong>
            <p>
              {text("process started")}: {text(preview.process_started ? "true" : "false")} /{" "}
              {text("script content read")}: {text(preview.script_content_read ? "true" : "false")} /{" "}
              {text("durable Zhishu write")}: {text(preview.durable_zhishu_write ? "true" : "false")}
            </p>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
            <small>
              {text("Denied")}: {preview.denied_actions.map((action) => text(action)).join(", ")}
            </small>
          </div>

          <div className="source-gate-list">
            {preview.manifests.map((manifest) => {
              const contract = preview.execution_contracts.find(
                (item) => item.skill_id === manifest.skill_id,
              );
              return (
                <article className="source-gate-item" key={manifest.skill_id}>
                  <div>
                    <span>{text(manifest.owner_center)} / {text(manifest.governed_by)}</span>
                    <strong>{manifest.name}</strong>
                  </div>
                  <b>{text(manifest.manifest_state)} / {manifest.version}</b>
                  <small>
                    {text("execution mode")}: {text(manifest.execution_mode)}; {text("admission")}:{" "}
                    {text(manifest.admission_policy)}
                  </small>
                  <div className="policy-tiers">
                    {manifest.tests_required.map((test) => (
                      <span key={test}>{text(test)}</span>
                    ))}
                  </div>
                  {contract && (
                    <small>
                      {text(contract.state)} / {text("output")}: {text(contract.output_policy)}
                    </small>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <p className="empty-state">{text("Skill library preview has not been loaded yet.")}</p>
      )}
    </section>
  );
}
