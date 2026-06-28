import type { SynthesisPreview } from "../types";

type SynthesisPanelProps = {
  isLoading: boolean;
  onPromote: (candidateId: string, candidateKind: "summary" | "association") => void;
  onRefresh: () => void;
  preview: SynthesisPreview | null;
  promotingCandidateId: string | null;
};

export function SynthesisPanel({
  isLoading,
  onPromote,
  onRefresh,
  preview,
  promotingCandidateId,
}: SynthesisPanelProps) {
  return (
    <section className="panel synthesis-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Zhishu synthesis</p>
          <h3>Summary and links</h3>
        </div>
        <button className="text-action" type="button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {!preview && <span className="empty-state">No synthesis preview yet.</span>}
      {preview && (
        <>
          <div className="maintenance-job-list">
            {preview.maintenance_jobs.map((job) => (
              <article className="maintenance-job-item" key={job.id}>
                <span>{job.readiness}</span>
                <strong>{job.label}</strong>
                <small>
                  {job.candidate_count} candidate{job.candidate_count === 1 ? "" : "s"} / {job.cadence} /{" "}
                  {job.gate}
                </small>
                <em>{job.admission_gate}</em>
              </article>
            ))}
          </div>
          <div className="synthesis-grid">
            <div className="synthesis-column">
              <span>{preview.admission_gate}</span>
              {preview.summary_candidates.length === 0 && (
                <small>No summary candidates yet.</small>
              )}
              {preview.summary_candidates.map((candidate) => (
                <article className="synthesis-item" key={candidate.id}>
                  <b>{candidate.review_state}</b>
                  <strong>{candidate.title}</strong>
                  <p>{candidate.summary}</p>
                  <small>
                    {candidate.source_item_count} source item
                    {candidate.source_item_count === 1 ? "" : "s"} / {candidate.suggested_level}
                  </small>
                  <em>{candidate.admission_gate}</em>
                  {candidate.source_memory_ids.length > 0 && (
                    <div className="synthesis-source-list">
                      {candidate.source_memory_ids.slice(0, 3).map((sourceId) => (
                        <span key={`${candidate.id}-${sourceId}`}>{sourceId}</span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onPromote(candidate.id, "summary")}
                  disabled={promotingCandidateId === candidate.id}
                >
                  {promotingCandidateId === candidate.id ? "Approving" : "Approve"}
                </button>
                </article>
              ))}
            </div>

            <div className="synthesis-column">
              <span>Association candidates</span>
              {preview.association_candidates.length === 0 && (
                <small>No association candidates yet.</small>
              )}
              {preview.association_candidates.map((candidate) => (
                <article className="synthesis-item" key={candidate.id}>
                  <b>{Math.round(candidate.score * 100)}%</b>
                  <strong>{candidate.label}</strong>
                  <p>{candidate.reason}</p>
                  <small>
                    {candidate.target_kind} / {candidate.review_state}
                  </small>
                  <em>{candidate.admission_gate}</em>
                  <div className="synthesis-source-list">
                    <span>{candidate.source_memory_id}</span>
                    <span>{candidate.target_id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPromote(candidate.id, "association")}
                  disabled={promotingCandidateId === candidate.id}
                >
                  {promotingCandidateId === candidate.id ? "Approving" : "Approve"}
                </button>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
