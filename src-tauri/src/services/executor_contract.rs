use crate::executor_contract;

pub fn preview() -> Result<executor_contract::ExecutorContractPreview, String> {
    executor_contract::preview()
        .map_err(|error| format!("Executor contract preview is unavailable: {error}"))
}
