use crate::{store, ReviewReceipt};

pub(crate) fn review_plan(
    preview: serde_json::Value,
    approved: bool,
    plan_id: Option<String>,
) -> Result<ReviewReceipt, String> {
    let mut receipt = crate::review_plan_preview(&preview, approved)?;

    if let Some(plan_id) = plan_id {
        if receipt.status == "approved" {
            let receipt_value = serde_json::to_value(&receipt)
                .map_err(|error| format!("Review serialization failed: {error}"))?;
            let execution = store::append_execution(plan_id.clone(), &preview, &receipt_value)
                .map_err(|error| format!("Execution queue write failed: {error}"))?;
            receipt.execution_queue_id = Some(execution.id);
        }

        let receipt_value = serde_json::to_value(&receipt)
            .map_err(|error| format!("Review serialization failed: {error}"))?;
        store::append_review(plan_id, receipt_value)
            .map_err(|error| format!("Review generated but history write failed: {error}"))?;
    }

    Ok(receipt)
}
