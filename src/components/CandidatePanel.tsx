import type { TaskCandidate } from "../types";

type CandidateDecision = "accepted" | "rejected" | "deepen";

type CandidatePanelProps = {
  candidates: TaskCandidate[];
  onReview: (candidateId: string, decision: CandidateDecision) => void;
  reviewingCandidateId: string | null;
};

export function CandidatePanel({ candidates, onReview, reviewingCandidateId }: CandidatePanelProps) {
  return (
    <section className="panel candidate-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Task candidates</p>
          <h3>Recent matches</h3>
        </div>
      </div>
      <div className="candidate-list">
        {candidates.length === 0 && <span className="empty-state">No candidates yet.</span>}
        {candidates.map((candidate) => {
          const isReviewing = reviewingCandidateId === candidate.id;
          const isTerminal = candidate.status === "accepted" || candidate.status === "rejected";
          const isDeepeningQueued = candidate.status === "needs-deepening";

          return (
            <article className="candidate-item" key={candidate.id}>
              <div>
                <span>{candidate.task_direction_title}</span>
                <strong>{candidate.summary}</strong>
                <p>{candidate.explanation}</p>
              </div>
              <b>{Math.round(candidate.score * 100)}%</b>
              <small>{candidate.status}</small>
              {candidate.source_candidate_id && <small>source candidate: {candidate.source_candidate_id}</small>}
              {candidate.score_components && (
                <div className="candidate-score-details">
                  <span>keywords {Math.round(candidate.score_components.keyword_score * 100)}%</span>
                  <span>priority {Math.round(candidate.score_components.priority_score * 100)}%</span>
                  <span>memory {Math.round(candidate.score_components.memory_confidence * 100)}%</span>
                </div>
              )}
              {candidate.matched_keywords.length > 0 && (
                <div className="memory-tags">
                  {candidate.matched_keywords.map((keyword) => (
                    <b key={keyword}>{keyword}</b>
                  ))}
                </div>
              )}
              {candidate.evidence && candidate.evidence.length > 0 && (
                <div className="candidate-evidence">
                  {candidate.evidence.map((item) => (
                    <span key={`${candidate.id}-${item.label}`}>
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              )}
              <div className="candidate-actions">
                <button
                  type="button"
                  onClick={() => onReview(candidate.id, "accepted")}
                  disabled={isReviewing || isTerminal}
                >
                  {candidate.status === "accepted" ? "Accepted" : "Accept"}
                </button>
                <button
                  type="button"
                  onClick={() => onReview(candidate.id, "deepen")}
                  disabled={isReviewing || isTerminal || isDeepeningQueued}
                >
                  {isDeepeningQueued ? "Queued" : "Deepen"}
                </button>
                <button
                  type="button"
                  onClick={() => onReview(candidate.id, "rejected")}
                  disabled={isReviewing || isTerminal}
                >
                  {candidate.status === "rejected" ? "Rejected" : "Reject"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
