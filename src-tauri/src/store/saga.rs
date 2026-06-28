use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{now_millis, paths, StoreError};

static SAGA_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SagaTransaction {
    pub id: String,
    pub kind: String,
    pub target_id: String,
    pub state: String,
    pub metadata: serde_json::Value,
    pub created_at_ms: u128,
    pub updated_at_ms: u128,
}

pub fn begin_saga(
    kind: String,
    target_id: String,
    metadata: serde_json::Value,
) -> Result<SagaTransaction, StoreError> {
    let kind = required(kind, "saga kind")?;
    let target_id = required(target_id, "saga target id")?;
    let now = now_millis();
    let record = SagaTransaction {
        id: format!(
            "saga-{now}-{}",
            SAGA_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ),
        kind,
        target_id,
        state: "pending".to_string(),
        metadata,
        created_at_ms: now,
        updated_at_ms: now,
    };
    let connection = open_database()?;
    connection.execute(
        "INSERT INTO saga_transactions (id, kind, target_id, state, metadata, created_at_ms, updated_at_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![record.id, record.kind, record.target_id, record.state, serde_json::to_string(&record.metadata)?, record.created_at_ms.to_string(), record.updated_at_ms.to_string()],
    )?;
    Ok(record)
}

pub fn transition_saga(id: String, state: String) -> Result<SagaTransaction, StoreError> {
    let state = required(state, "saga state")?;
    if !matches!(
        state.as_str(),
        "committed" | "compensating" | "compensated" | "failed" | "resolved"
    ) {
        return Err(StoreError::InvalidInput(format!(
            "unsupported saga state: {state}"
        )));
    }
    let connection = open_database()?;
    let current = get_saga_with(&connection, &id)?;
    if !is_allowed_transition(&current.state, &state) {
        return Err(StoreError::InvalidInput(format!(
            "invalid saga transition: {} -> {state}",
            current.state
        )));
    }
    let updated_at_ms = now_millis();
    let changed = connection.execute(
        "UPDATE saga_transactions SET state = ?1, updated_at_ms = ?2 WHERE id = ?3 AND state = ?4",
        params![state, updated_at_ms.to_string(), id, current.state],
    )?;
    if changed == 0 {
        return Err(StoreError::InvalidInput(
            "saga state changed concurrently; reload before retrying".to_string(),
        ));
    }
    get_saga_with(&connection, &id)
}

pub fn get_saga(id: String) -> Result<SagaTransaction, StoreError> {
    get_saga_with(&open_database()?, &id)
}

pub fn list_sagas(limit: usize) -> Result<Vec<SagaTransaction>, StoreError> {
    let limit = limit.clamp(1, 100);
    let connection = open_database()?;
    let mut statement = connection.prepare(
        "SELECT id, kind, target_id, state, metadata, created_at_ms, updated_at_ms
         FROM saga_transactions
         ORDER BY updated_at_ms DESC, created_at_ms DESC
         LIMIT ?1",
    )?;
    let rows = statement.query_map([limit.to_string()], saga_from_row)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StoreError::from)
}

fn get_saga_with(connection: &Connection, id: &str) -> Result<SagaTransaction, StoreError> {
    connection.query_row(
        "SELECT id, kind, target_id, state, metadata, created_at_ms, updated_at_ms FROM saga_transactions WHERE id = ?1",
        [id],
        saga_from_row,
    ).optional()?.ok_or_else(|| StoreError::NotFound(id.to_string()))
}

fn saga_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SagaTransaction> {
    Ok(SagaTransaction {
        id: row.get(0)?,
        kind: row.get(1)?,
        target_id: row.get(2)?,
        state: row.get(3)?,
        metadata: serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(4)?).map_err(
            |error| {
                rusqlite::Error::FromSqlConversionFailure(
                    4,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            },
        )?,
        created_at_ms: row.get::<_, String>(5)?.parse().unwrap_or_default(),
        updated_at_ms: row.get::<_, String>(6)?.parse().unwrap_or_default(),
    })
}

fn open_database() -> Result<Connection, StoreError> {
    let path: PathBuf = paths::memory_path()
        .parent()
        .expect("memory store must have a parent")
        .join("synapse.db");
    let connection = Connection::open(path)?;
    connection.execute_batch("CREATE TABLE IF NOT EXISTS saga_transactions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, target_id TEXT NOT NULL, state TEXT NOT NULL, metadata TEXT NOT NULL, created_at_ms TEXT NOT NULL, updated_at_ms TEXT NOT NULL);")?;
    Ok(connection)
}

fn required(value: String, label: &str) -> Result<String, StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(StoreError::InvalidInput(format!("{label} cannot be empty")));
    }
    Ok(value)
}

fn is_allowed_transition(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        ("pending", "committed" | "compensating" | "failed")
            | ("compensating", "compensated" | "failed")
            | ("failed", "resolved")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_only_recoverable_saga_transitions() {
        assert!(is_allowed_transition("pending", "committed"));
        assert!(is_allowed_transition("pending", "compensating"));
        assert!(is_allowed_transition("compensating", "compensated"));
        assert!(is_allowed_transition("failed", "resolved"));
        assert!(!is_allowed_transition("committed", "compensating"));
        assert!(!is_allowed_transition("compensated", "pending"));
        assert!(!is_allowed_transition("pending", "resolved"));
    }

    #[test]
    fn lists_recent_saga_transactions() {
        let kind = format!("test-list-{}", now_millis());
        let first =
            begin_saga(kind.clone(), "target-1".to_string(), serde_json::json!({})).unwrap();
        let second =
            begin_saga(kind.clone(), "target-2".to_string(), serde_json::json!({})).unwrap();

        let records = list_sagas(100)
            .unwrap()
            .into_iter()
            .filter(|record| record.kind == kind)
            .collect::<Vec<_>>();
        assert!(records.iter().any(|record| record.id == first.id));
        assert!(records.iter().any(|record| record.id == second.id));
    }
}
