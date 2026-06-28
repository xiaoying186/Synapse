//! Runtime driver selection.

pub mod lite;
pub mod pro;

use crate::kernel::Plan;
use crate::traits::{DriverReceipt, ExecutionDriver, Mode};

pub fn select(mode: Mode) -> Box<dyn ExecutionDriver> {
    match mode {
        Mode::Lite => Box::new(lite::LiteDriver),
        Mode::Pro => Box::new(pro::ProDriver),
    }
}

pub fn preview_for_mode(mode: Mode, plan: &Plan) -> DriverReceipt {
    match mode {
        Mode::Lite => lite::preview_receipt(plan),
        Mode::Pro => pro::preview_receipt(plan),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn plan() -> Plan {
        Plan {
            intent: "update test".to_string(),
            risk: "medium".to_string(),
            steps: vec!["one".to_string()],
            constraints: json!({}),
            context_refs: Vec::new(),
            audit_required: true,
            route: "L1_REVIEW with reviewable changes".to_string(),
        }
    }

    #[test]
    fn selects_driver_by_mode() {
        assert_eq!(select(Mode::Lite).mode(), Mode::Lite);
        assert_eq!(select(Mode::Pro).mode(), Mode::Pro);
    }

    #[test]
    fn previews_driver_receipt_by_mode() {
        assert_eq!(preview_for_mode(Mode::Lite, &plan()).mode, "Lite");
        assert_eq!(preview_for_mode(Mode::Pro, &plan()).mode, "Pro");
    }
}
