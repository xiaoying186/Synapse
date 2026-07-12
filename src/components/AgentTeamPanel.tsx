import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type {
  AgentTeamExecutionReceipt,
  AgentTeamPreview,
  AgentTeamRealExecutionReceipt,
  AgentTeamRealExecutionPreflight,
  AgentTeamRealStagingReceipt,
  AgentTeamRequest,
  ArsenalPreview,
  TaskRunRecord,
} from "../types";

type AgentTeamPanelProps = {
  arsenalPreview: ArsenalPreview | null;
  isExecuting: boolean;
  isExecutingReal: boolean;
  isCancellingReal: boolean;
  isPreflightingReal: boolean;
  isStagingReal: boolean;
  isPreviewing: boolean;
  onExecute: (request: AgentTeamRequest) => void;
  onExecuteReal: (request: AgentTeamRequest) => void;
  onCancelReal: (runId: string) => void;
  onPreflightReal: (request: AgentTeamRequest) => void;
  onPreview: (request: AgentTeamRequest) => void;
  onStageReal: (request: AgentTeamRequest) => void;
  preview: AgentTeamPreview | null;
  realExecutionReceipt: AgentTeamRealExecutionReceipt | null;
  realPreflight: AgentTeamRealExecutionPreflight | null;
  realStagingReceipt: AgentTeamRealStagingReceipt | null;
  receipt: AgentTeamExecutionReceipt | null;
  runs: TaskRunRecord[];
};

export function AgentTeamPanel({
  arsenalPreview,
  isExecuting,
  isExecutingReal,
  isCancellingReal,
  isPreflightingReal,
  isStagingReal,
  isPreviewing,
  onExecute,
  onExecuteReal,
  onCancelReal,
  onPreflightReal,
  onPreview,
  onStageReal,
  preview,
  realExecutionReceipt,
  realPreflight,
  realStagingReceipt,
  receipt,
  runs,
}: AgentTeamPanelProps) {
  const { text } = useI18n();
  const agents = useMemo(
    () => (arsenalPreview?.tools ?? []).filter((tool) => tool.category === "agent"),
    [arsenalPreview],
  );
  const [runId, setRunId] = useState("");
  const [teamMode, setTeamMode] = useState<"linear" | "roundtable">("linear");
  const [contextMode, setContextMode] = useState<"native" | "deep">("native");
  const [goal, setGoal] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [maxRounds, setMaxRounds] = useState(1);
  const [maxAgentCalls, setMaxAgentCalls] = useState(4);
  const [cancelAfterSteps, setCancelAfterSteps] = useState(0);
  const [lastRequest, setLastRequest] = useState<AgentTeamRequest | null>(null);

  function toggleParticipant(toolId: string) {
    setParticipants((current) =>
      current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : current.length < 4
          ? [...current, toolId]
          : current,
    );
  }

  return (
    <section className="panel agent-team-panel" data-testid="agent-team-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Agent team")}</p>
          <h3>{text("Bounded orchestration graph")}</h3>
        </div>
        <strong>{text(preview?.state ?? "preview only")}</strong>
      </div>
      <form
        className="agent-team-form"
        onSubmit={(event) => {
          event.preventDefault();
          const request = {
            run_id: runId,
            team_mode: teamMode,
            context_mode: contextMode,
            goal,
            participant_tool_ids: participants,
            max_rounds: maxRounds,
            max_agent_calls: maxAgentCalls,
            ...(cancelAfterSteps > 0 ? { cancel_after_steps: cancelAfterSteps } : {}),
          } satisfies AgentTeamRequest;
          setLastRequest(request);
          onPreview(request);
        }}
      >
        <select
          data-testid="agent-team-mode-select"
          value={teamMode}
          onChange={(event) => setTeamMode(event.target.value as typeof teamMode)}
        >
          <option value="linear">{text("Linear workflow")}</option>
          <option value="roundtable">{text("Roundtable review")}</option>
        </select>
        <select
          data-testid="agent-team-context-select"
          value={contextMode}
          onChange={(event) => setContextMode(event.target.value as typeof contextMode)}
        >
          <option value="native">{text("Native context")}</option>
          <option value="deep">{text("Zhishu-constrained context")}</option>
        </select>
        <select
          data-testid="agent-team-run-select"
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
        >
          <option value="">{text("Select Task Run")}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {text(run.approval_state)}
            </option>
          ))}
        </select>
        <label>
          {text("Rounds")}
          <input
            type="number"
            min="1"
            max="3"
            value={maxRounds}
            onChange={(event) => setMaxRounds(Number(event.target.value))}
          />
        </label>
        <label>
          {text("Call budget")}
          <input
            type="number"
            min="1"
            max="12"
            value={maxAgentCalls}
            onChange={(event) => setMaxAgentCalls(Number(event.target.value))}
          />
        </label>
        <label>
          {text("Cancel after calls")}
          <input
            type="number"
            min="0"
            max="12"
            value={cancelAfterSteps}
            onChange={(event) => setCancelAfterSteps(Number(event.target.value))}
          />
        </label>
        <textarea
          data-testid="agent-team-goal-input"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder={text("Team goal")}
        />
        <div className="agent-team-members">
          {agents.map((agent) => (
            <label key={agent.id}>
              <input
                data-testid={`agent-team-participant-${agent.id}`}
                type="checkbox"
                checked={participants.includes(agent.id)}
                onChange={() => toggleParticipant(agent.id)}
              />
              <span>
                {text(agent.label)} / {text(agent.discovery_state)} / {text(agent.allow_state)}
              </span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          data-testid="agent-team-preview-button"
          disabled={isPreviewing || !runId || !goal.trim() || participants.length < 2}
        >
          {isPreviewing ? text("Building graph") : text("Build team preview")}
        </button>
        <button
          type="button"
          disabled={
            isExecuting ||
            preview?.state !== "blueprint-preview-ready" ||
            !lastRequest ||
            preview.run_id !== lastRequest.run_id ||
            preview.goal !== lastRequest.goal
          }
          onClick={() => lastRequest && onExecute(lastRequest)}
        >
          {isExecuting ? text("Recording fake execution") : text("Execute fake team")}
        </button>
        <button
          type="button"
          data-testid="agent-team-real-preflight-button"
          disabled={
            isPreflightingReal ||
            preview?.state !== "blueprint-preview-ready" ||
            !lastRequest ||
            preview.run_id !== lastRequest.run_id ||
            preview.goal !== lastRequest.goal
          }
          onClick={() => lastRequest && onPreflightReal(lastRequest)}
        >
          {isPreflightingReal ? text("Preflighting real team") : text("Preflight real team")}
        </button>
        <button
          type="button"
          data-testid="agent-team-real-staging-button"
          disabled={
            isStagingReal ||
            !realPreflight ||
            !lastRequest ||
            preview?.state !== "blueprint-preview-ready" ||
            preview.run_id !== lastRequest.run_id ||
            preview.goal !== lastRequest.goal
          }
          onClick={() => lastRequest && onStageReal(lastRequest)}
        >
          {isStagingReal ? text("Recording real staging") : text("Record real staging receipt")}
        </button>
        <button
          type="button"
          data-testid="agent-team-real-execution-button"
          disabled={
            isExecutingReal ||
            !realPreflight ||
            realPreflight.state !== "ready-for-final-human-team-execution-approval" ||
            !lastRequest ||
            preview?.state !== "blueprint-preview-ready" ||
            preview.run_id !== lastRequest.run_id ||
            preview.goal !== lastRequest.goal
          }
          onClick={() => lastRequest && onExecuteReal(lastRequest)}
        >
          {isExecutingReal ? text("Executing real team") : text("Execute real team")}
        </button>
        <button
          type="button"
          data-testid="agent-team-real-cancel-button"
          disabled={!isExecutingReal || isCancellingReal || !lastRequest}
          onClick={() => lastRequest && onCancelReal(lastRequest.run_id)}
        >
          {isCancellingReal ? text("Requesting cancellation") : text("Cancel real Agent team")}
        </button>
      </form>
      {preview && (
        <div className="agent-team-preview">
          <span>
            {preview.participants.length} {text("members")} / {preview.max_rounds} {text("rounds")}
          </span>
          <strong>{preview.estimated_agent_calls} {text("estimated agent calls")}</strong>
          <small>
            {text("budget")}: {preview.max_agent_calls} / {text("cancel after")}:{" "}
            {preview.cancel_after_steps ?? text("none")}
          </small>
          <div className="agent-team-steps">
            {preview.steps.map((step) => (
              <article key={`${step.order}-${step.participant_tool_id}`}>
                <b>{step.order}</b>
                <div>
                  <strong>{step.participant_tool_id}</strong>
                  <span>
                    {text(step.phase)} / {text(step.input_source)}
                  </span>
                  <small>{text(step.output_policy)}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {receipt && (
        <div className="task-run-result">
          <span>
            {text(receipt.state)} / {text(receipt.execution_mode)} / {receipt.calls_completed}{" "}
            {text("calls")} / {receipt.calls_blocked} {text("blocked")}
          </span>
          <strong>{receipt.artifact.title}</strong>
          <small>
            {text("stop reason")}: {text(receipt.stop_reason)} /{" "}
            {text("process started")}: {text(receipt.process_started ? "true" : "false")} /{" "}
            {text("artifact")}: {receipt.artifact.id}
          </small>
        </div>
      )}
      {realPreflight && (
        <div className="task-run-result" data-testid="agent-team-real-preflight-result">
          <span>
            {text(realPreflight.state)} / {realPreflight.executable_step_count}{" "}
            {text("executable")} / {realPreflight.blocked_step_count} {text("blocked")}
          </span>
          <strong>
            {text("process started")}: {text(realPreflight.process_started ? "true" : "false")} /{" "}
            {text("task content sent")}: {text(realPreflight.task_content_sent ? "true" : "false")}
          </strong>
          <div className="agent-team-steps">
            {realPreflight.step_preflights.map((step) => (
              <article key={`${step.order}-${step.participant_tool_id}-real`}>
                <b>{step.order}</b>
                <div>
                  <strong>{step.participant_tool_id}</strong>
                  <span>{text(step.state)}</span>
                  <small>
                    {step.blockers.map((blocker) => text(blocker.id)).join(", ") || text("no blockers")}
                  </small>
                </div>
              </article>
            ))}
          </div>
          <div className="policy-tiers">
            {realPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {realStagingReceipt && (
        <div className="task-run-result" data-testid="agent-team-real-staging-result">
          <span>
            {text(realStagingReceipt.state)} / {text(realStagingReceipt.execution_mode)} /{" "}
            {realStagingReceipt.staged_step_count} {text("staged")}
          </span>
          <strong>
            {text("process started")}: {text(realStagingReceipt.process_started ? "true" : "false")} /{" "}
            {text("task content sent")}: {text(realStagingReceipt.task_content_sent ? "true" : "false")}
          </strong>
          <small>
            {text("executable")}: {realStagingReceipt.executable_step_count} / {text("blocked")}:{" "}
            {realStagingReceipt.blocked_step_count} / {text("artifact")}: {realStagingReceipt.artifact.id}
          </small>
          <div className="policy-tiers">
            {realStagingReceipt.steps.slice(0, 6).map((step) => (
              <span key={`${step.order}-${step.participant_tool_id}-staging`}>
                {step.order}. {text(step.admission_state)}
              </span>
            ))}
          </div>
        </div>
      )}
      {realExecutionReceipt && (
        <div className="task-run-result" data-testid="agent-team-real-execution-result">
          <span>
            {text(realExecutionReceipt.state)} / {text(realExecutionReceipt.execution_mode)} /{" "}
            {realExecutionReceipt.calls_completed} {text("calls")}
          </span>
          <strong>
            {text("process started")}: {text(realExecutionReceipt.process_started ? "true" : "false")} /{" "}
            {text("task content sent")}: {text(realExecutionReceipt.task_content_sent ? "true" : "false")}
          </strong>
          <small>
            {text("blocked")}: {realExecutionReceipt.calls_blocked} / {text("stop reason")}:{" "}
            {text(realExecutionReceipt.stop_reason)} / {text("artifact")}: {realExecutionReceipt.artifact.id}
          </small>
          <small data-testid="agent-team-real-lifecycle-result">
            {text("cancellation observed")}: {text(realExecutionReceipt.cancellation_observed ? "true" : "false")}
            {realExecutionReceipt.failure_detail ? ` / ${text("failure")}: ${realExecutionReceipt.failure_detail}` : ""}
          </small>
          <small data-testid="agent-team-real-transaction-receipt">
            {text("Snapshot")}: {realExecutionReceipt.rollback_snapshot.id} / {text("Audit event")}: {realExecutionReceipt.audit_event.id} / {text("Saga")}: {text(realExecutionReceipt.saga.state)}
          </small>
          <div className="policy-tiers">
            {realExecutionReceipt.steps.slice(0, 6).map((step) => (
              <span key={`${step.order}-${step.participant_tool_id}-real-execution`}>
                {step.order}. {text(step.admission_state)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
