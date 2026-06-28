//! Shared contracts for Lite and Pro execution drivers.

use async_trait::async_trait;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Lite,
    Pro,
}

impl Mode {
    pub fn from_config(value: &str) -> Self {
        match value.to_ascii_lowercase().as_str() {
            "pro" => Self::Pro,
            _ => Self::Lite,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Lite => "Lite",
            Self::Pro => "Pro",
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DriverReceipt {
    pub mode: String,
    pub status: String,
    pub accepted_steps: usize,
    pub blocked_reason: Option<String>,
}

#[async_trait]
pub trait ExecutionDriver: Send + Sync {
    fn mode(&self) -> Mode;

    async fn execute(&self, plan: &crate::kernel::Plan) -> Result<DriverReceipt, DriverError>;
}

#[derive(Debug, thiserror::Error)]
pub enum DriverError {
    #[error("step failed: {0}")]
    StepFailed(String),
    #[error("saga compensation failed: {0}")]
    SagaFailed(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}
