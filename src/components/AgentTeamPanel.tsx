import { useMemo, useState } from "react";
import type {
  AgentTeamPreview,
  AgentTeamRequest,
  ArsenalPreview,
  TaskRunRecord,
} from "../types";

type AgentTeamPanelProps = {
  arsenalPreview: ArsenalPreview | null;
  isPreviewing: boolean;
  onPreview: (request: AgentTeamRequest) => void;
  preview: AgentTeamPreview | null;
  runs: TaskRunRecord[];
};

export function AgentTeamPanel({
  arsenalPreview,
  isPreviewing,
  onPreview,
  preview,
  runs,
}: AgentTeamPanelProps) {
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
    <section className="panel agent-team-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Agent team</p>
          <h3>Bounded orchestration graph</h3>
        </div>
        <strong>{preview?.state ?? "preview only"}</strong>
      </div>
      <form
        className="agent-team-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview({
            run_id: runId,
            team_mode: teamMode,
            context_mode: contextMode,
            goal,
            participant_tool_ids: participants,
            max_rounds: maxRounds,
          });
        }}
      >
        <select value={teamMode} onChange={(event) => setTeamMode(event.target.value as typeof teamMode)}>
          <option value="linear">Linear workflow</option>
          <option value="roundtable">Roundtable review</option>
        </select>
        <select
          value={contextMode}
          onChange={(event) => setContextMode(event.target.value as typeof contextMode)}
        >
          <option value="native">Native context</option>
          <option value="deep">Zhishu-constrained context</option>
        </select>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Select Task Run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.approval_state}
            </option>
          ))}
        </select>
        <label>
          Rounds
          <input
            type="number"
            min="1"
            max="3"
            value={maxRounds}
            onChange={(event) => setMaxRounds(Number(event.target.value))}
          />
        </label>
        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Team goal"
        />
        <div className="agent-team-members">
          {agents.map((agent) => (
            <label key={agent.id}>
              <input
                type="checkbox"
                checked={participants.includes(agent.id)}
                onChange={() => toggleParticipant(agent.id)}
              />
              <span>
                {agent.label} / {agent.discovery_state} / {agent.allow_state}
              </span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isPreviewing || !runId || !goal.trim() || participants.length < 2}
        >
          {isPreviewing ? "Building graph" : "Build team preview"}
        </button>
      </form>
      {preview && (
        <div className="agent-team-preview">
          <span>
            {preview.participants.length} members / {preview.max_rounds} rounds
          </span>
          <strong>{preview.estimated_agent_calls} estimated agent calls</strong>
          <div className="agent-team-steps">
            {preview.steps.map((step) => (
              <article key={`${step.order}-${step.participant_tool_id}`}>
                <b>{step.order}</b>
                <div>
                  <strong>{step.participant_tool_id}</strong>
                  <span>
                    {step.phase} / {step.input_source}
                  </span>
                  <small>{step.output_policy}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
