//! Context system primitives.
//!
//! Synapse keeps raw session state, working memory, and durable knowledge in
//! separate physical scopes. Promotion is one-way and must pass audit.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryScope {
    L0Session,
    L1Working,
    L2Knowledge,
}

impl MemoryScope {
    pub fn label(self) -> &'static str {
        match self {
            Self::L0Session => "L0 Session",
            Self::L1Working => "L1 Working",
            Self::L2Knowledge => "L2 Knowledge",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextReference {
    pub scope: MemoryScope,
    pub purpose: String,
}

impl ContextReference {
    pub fn label(&self) -> String {
        format!("{}: {}", self.scope.label(), self.purpose)
    }
}

pub fn references_for_risk(risk: &str) -> Vec<ContextReference> {
    let mut refs = vec![ContextReference {
        scope: MemoryScope::L0Session,
        purpose: "capture raw interaction".to_string(),
    }];

    if matches!(risk, "medium" | "high" | "destructive") {
        refs.push(ContextReference {
            scope: MemoryScope::L1Working,
            purpose: "stage facts for shadow validation".to_string(),
        });
    }

    if risk == "destructive" {
        refs.push(ContextReference {
            scope: MemoryScope::L2Knowledge,
            purpose: "read durable policy before execution".to_string(),
        });
    }

    refs
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RecallWeights {
    pub alpha: f64,
    pub beta: f64,
    pub gamma: f64,
    pub delta: f64,
}

impl Default for RecallWeights {
    fn default() -> Self {
        Self {
            alpha: 0.4,
            beta: 0.3,
            gamma: 0.2,
            delta: 0.1,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_memory_scopes() {
        assert_eq!(MemoryScope::L0Session.label(), "L0 Session");
        assert_eq!(MemoryScope::L1Working.label(), "L1 Working");
        assert_eq!(MemoryScope::L2Knowledge.label(), "L2 Knowledge");
    }

    #[test]
    fn returns_more_context_for_higher_risk() {
        assert_eq!(references_for_risk("low").len(), 1);
        assert_eq!(references_for_risk("medium").len(), 2);
        assert_eq!(references_for_risk("destructive").len(), 3);
    }

    #[test]
    fn formats_context_reference_label() {
        let reference = ContextReference {
            scope: MemoryScope::L1Working,
            purpose: "stage facts".to_string(),
        };

        assert_eq!(reference.label(), "L1 Working: stage facts");
    }
}
