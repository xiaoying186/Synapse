use crate::{config, store, PlanPreview};

pub(crate) fn submit_intent(intent: String) -> Result<PlanPreview, String> {
    let preview = crate::plan_preview_from_intent(config::read_runtime_config(), intent)?;
    let preview_value = serde_json::to_value(&preview)
        .map_err(|error| format!("Plan serialization failed: {error}"))?;

    store::append_preview(preview_value)
        .map_err(|error| format!("Plan generated but history write failed: {error}"))?;

    Ok(preview)
}
