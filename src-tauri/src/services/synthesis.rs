use crate::synthesis;

pub fn preview() -> Result<synthesis::SynthesisPreview, String> {
    synthesis::preview().map_err(|error| format!("Synthesis preview is unavailable: {error}"))
}

pub fn promote_candidate(
    candidate_id: String,
    candidate_kind: String,
) -> Result<synthesis::SynthesisPromotionReceipt, String> {
    synthesis::promote_candidate(candidate_id, candidate_kind)
        .map_err(|error| format!("Synthesis candidate could not be promoted: {error}"))
}
