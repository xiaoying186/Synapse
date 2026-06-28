use serde::{Deserialize, Serialize};

use crate::store;

const MAX_INPUT_BYTES: usize = 256 * 1024;
const MAX_ROWS: usize = 2000;

#[derive(Debug, Clone, Deserialize)]
pub struct StrategyConfig {
    pub name: String,
    pub short_window: usize,
    pub long_window: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuantResearchReport {
    pub strategy_name: String,
    pub strategy_version: String,
    pub state: String,
    pub sample_count: usize,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub strategy_return: Option<f64>,
    pub benchmark_return: Option<f64>,
    pub max_drawdown: Option<f64>,
    pub position_changes: usize,
    pub warnings: Vec<String>,
    pub disclaimer: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuantArchiveReceipt {
    pub report: QuantResearchReport,
    pub artifact: store::TaskArtifactRecord,
    pub run: store::TaskRunRecord,
}

#[derive(Debug)]
struct PriceRow {
    date: String,
    close: f64,
}

pub fn research(
    csv: String,
    config: StrategyConfig,
) -> Result<QuantResearchReport, store::StoreError> {
    validate_config(&config)?;
    let rows = parse_csv(&csv)?;
    let minimum = config.long_window + 2;
    if rows.len() < minimum {
        return Ok(QuantResearchReport {
            strategy_name: config.name.trim().to_string(),
            strategy_version: strategy_version(&config),
            state: "insufficient-data".to_string(),
            sample_count: rows.len(),
            start_date: rows.first().map(|row| row.date.clone()),
            end_date: rows.last().map(|row| row.date.clone()),
            strategy_return: None,
            benchmark_return: None,
            max_drawdown: None,
            position_changes: 0,
            warnings: vec![format!(
                "At least {minimum} valid rows are required; no strategy conclusion was produced."
            )],
            disclaimer: disclaimer(),
        });
    }

    let mut equity: f64 = 1.0;
    let mut peak: f64 = 1.0;
    let mut max_drawdown = 0.0_f64;
    let mut position = false;
    let mut position_changes = 0;
    for index in config.long_window..rows.len() {
        let short = mean_close(&rows[index - config.short_window..index]);
        let long = mean_close(&rows[index - config.long_window..index]);
        let next_position = short > long;
        if next_position != position {
            position_changes += 1;
            position = next_position;
        }
        if position {
            equity *= rows[index].close / rows[index - 1].close;
        }
        peak = peak.max(equity);
        max_drawdown = max_drawdown.min(equity / peak - 1.0);
    }
    let benchmark = rows.last().unwrap().close / rows.first().unwrap().close - 1.0;

    Ok(QuantResearchReport {
        strategy_name: config.name.trim().to_string(),
        strategy_version: strategy_version(&config),
        state: "research-ready".to_string(),
        sample_count: rows.len(),
        start_date: rows.first().map(|row| row.date.clone()),
        end_date: rows.last().map(|row| row.date.clone()),
        strategy_return: Some(equity - 1.0),
        benchmark_return: Some(benchmark),
        max_drawdown: Some(max_drawdown),
        position_changes,
        warnings: vec![
            "No fees, slippage, suspension, limit-up/down, or corporate-action adjustment is modeled."
                .to_string(),
            "Results are historical simulation only and must not be treated as an order signal."
                .to_string(),
        ],
        disclaimer: disclaimer(),
    })
}

pub fn archive(
    run_id: String,
    csv: String,
    config: StrategyConfig,
) -> Result<QuantArchiveReceipt, store::StoreError> {
    let run = store::task_run_by_id(run_id.trim().to_string())?;
    if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        return Err(store::StoreError::InvalidInput(
            "quant research requires an approved, not-started Task Run".to_string(),
        ));
    }
    let report = research(csv, config)?;
    if report.state != "research-ready" {
        return Err(store::StoreError::InvalidInput(
            "insufficient data cannot be archived as a completed strategy report".to_string(),
        ));
    }
    let artifact = store::append_task_artifacts(
        run.id.clone(),
        run.task_direction_id.clone(),
        vec![store::NewTaskArtifact {
            artifact_type: "quant-research-report".to_string(),
            reference_id: format!("quant-research-{}", store::now_millis()),
            title: report.strategy_name.clone(),
            summary: format!(
                "{} samples; strategy return {:.2}%; max drawdown {:.2}%.",
                report.sample_count,
                report.strategy_return.unwrap_or_default() * 100.0,
                report.max_drawdown.unwrap_or_default() * 100.0,
            ),
            metadata: serde_json::to_value(&report)?,
        }],
    )?
    .remove(0);
    let completed = store::complete_domain_task_run(
        run.id.clone(),
        format!("Quant research archived as artifact {}.", artifact.id),
    )?;
    Ok(QuantArchiveReceipt {
        report,
        artifact,
        run: completed,
    })
}

fn parse_csv(raw: &str) -> Result<Vec<PriceRow>, store::StoreError> {
    if raw.len() > MAX_INPUT_BYTES {
        return Err(store::StoreError::InvalidInput(
            "quant CSV exceeds 256 KB".to_string(),
        ));
    }
    let mut lines = raw.lines().filter(|line| !line.trim().is_empty());
    let header = lines.next().unwrap_or_default().to_ascii_lowercase();
    if header.split(',').map(str::trim).collect::<Vec<_>>() != ["date", "close"] {
        return Err(store::StoreError::InvalidInput(
            "quant CSV header must be date,close".to_string(),
        ));
    }
    let mut rows = Vec::new();
    for line in lines.take(MAX_ROWS + 1) {
        let Some((date, close)) = line.split_once(',') else {
            return Err(store::StoreError::InvalidInput(
                "quant CSV rows must contain date and close".to_string(),
            ));
        };
        let close = close.trim().parse::<f64>().map_err(|_| {
            store::StoreError::InvalidInput("quant close must be numeric".to_string())
        })?;
        if !close.is_finite() || close <= 0.0 {
            return Err(store::StoreError::InvalidInput(
                "quant close must be a positive finite number".to_string(),
            ));
        }
        rows.push(PriceRow {
            date: date.trim().to_string(),
            close,
        });
    }
    if rows.len() > MAX_ROWS {
        return Err(store::StoreError::InvalidInput(
            "quant CSV exceeds 2000 rows".to_string(),
        ));
    }
    Ok(rows)
}

fn validate_config(config: &StrategyConfig) -> Result<(), store::StoreError> {
    if config.name.trim().is_empty()
        || config.short_window < 2
        || config.long_window <= config.short_window
        || config.long_window > 250
    {
        return Err(store::StoreError::InvalidInput(
            "strategy requires a name and windows satisfying 2 <= short < long <= 250".to_string(),
        ));
    }
    Ok(())
}

fn mean_close(rows: &[PriceRow]) -> f64 {
    rows.iter().map(|row| row.close).sum::<f64>() / rows.len() as f64
}

fn strategy_version(config: &StrategyConfig) -> String {
    format!(
        "ma-crossover-v1-{}-{}",
        config.short_window, config.long_window
    )
}

fn disclaimer() -> String {
    "Research and simulation only. No brokerage connection, order generation, or investment advice."
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stops_when_samples_are_insufficient() {
        let report = research(
            "date,close\n2026-01-01,10\n2026-01-02,11".to_string(),
            StrategyConfig {
                name: "MA".to_string(),
                short_window: 2,
                long_window: 5,
            },
        )
        .unwrap();
        assert_eq!(report.state, "insufficient-data");
        assert!(report.strategy_return.is_none());
    }

    #[test]
    fn simulates_bounded_moving_average_strategy() {
        let rows = (1..=30)
            .map(|day| format!("2026-01-{day:02},{}", 10.0 + f64::from(day)))
            .collect::<Vec<_>>()
            .join("\n");
        let report = research(
            format!("date,close\n{rows}"),
            StrategyConfig {
                name: "MA".to_string(),
                short_window: 3,
                long_window: 10,
            },
        )
        .unwrap();
        assert_eq!(report.state, "research-ready");
        assert!(report.strategy_return.is_some());
    }
}
