use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{paths, read_json_records_from_file, StoreError, STORE_SCHEMA_VERSION};

const MEMORY_COLLECTION: &str = "memory-items";
const RELATION_COLLECTION: &str = "zhishu-relations";
const MAINTENANCE_COLLECTION: &str = "zhishu-maintenance-findings";

pub(crate) trait StoreRepository {
    fn read_collection(
        &self,
        legacy_path: &Path,
        collection: &str,
    ) -> Result<Vec<Value>, StoreError>;
    fn replace_collection(&self, collection: &str, records: &[Value]) -> Result<(), StoreError>;
}

struct SqliteStoreRepository {
    path: PathBuf,
}

impl StoreRepository for SqliteStoreRepository {
    fn read_collection(
        &self,
        legacy_path: &Path,
        collection: &str,
    ) -> Result<Vec<Value>, StoreError> {
        read_values_at(&self.path, legacy_path, collection)
    }

    fn replace_collection(&self, collection: &str, records: &[Value]) -> Result<(), StoreError> {
        write_values_at(&self.path, collection, records)
    }
}

pub(crate) fn collection_for_path(path: &Path) -> Option<&'static str> {
    if path == paths::memory_path() {
        Some(MEMORY_COLLECTION)
    } else if path == paths::zhishu_relation_path() {
        Some(RELATION_COLLECTION)
    } else if path == paths::zhishu_maintenance_finding_path() {
        Some(MAINTENANCE_COLLECTION)
    } else {
        None
    }
}

pub(crate) fn read_values(legacy_path: &Path, collection: &str) -> Result<Vec<Value>, StoreError> {
    repository().read_collection(legacy_path, collection)
}

pub(crate) fn write_values(collection: &str, records: &[Value]) -> Result<(), StoreError> {
    repository().replace_collection(collection, records)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZhishuRepositoryBundle {
    pub schema_version: u16,
    pub memory_items: Vec<Value>,
    pub relations: Vec<Value>,
    pub maintenance_findings: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZhishuRepositoryImportReceipt {
    pub memory_items: usize,
    pub relations: usize,
    pub maintenance_findings: usize,
}

pub fn export_zhishu_repository() -> Result<ZhishuRepositoryBundle, StoreError> {
    Ok(ZhishuRepositoryBundle {
        schema_version: STORE_SCHEMA_VERSION,
        memory_items: read_values(&paths::memory_path(), MEMORY_COLLECTION)?,
        relations: read_values(&paths::zhishu_relation_path(), RELATION_COLLECTION)?,
        maintenance_findings: read_values(
            &paths::zhishu_maintenance_finding_path(),
            MAINTENANCE_COLLECTION,
        )?,
    })
}

pub fn import_zhishu_repository(raw: String) -> Result<ZhishuRepositoryImportReceipt, StoreError> {
    let bundle = serde_json::from_str::<ZhishuRepositoryBundle>(&raw)?;
    if bundle.schema_version > STORE_SCHEMA_VERSION {
        return Err(StoreError::InvalidInput(format!(
            "unsupported Zhishu repository schema version: {}",
            bundle.schema_version
        )));
    }
    validate_bundle(&bundle)?;

    let receipt = ZhishuRepositoryImportReceipt {
        memory_items: bundle.memory_items.len(),
        relations: bundle.relations.len(),
        maintenance_findings: bundle.maintenance_findings.len(),
    };
    let mut connection = open_database(&database_path())?;
    let transaction = connection.transaction()?;
    for (collection, records) in [
        (MEMORY_COLLECTION, bundle.memory_items),
        (RELATION_COLLECTION, bundle.relations),
        (MAINTENANCE_COLLECTION, bundle.maintenance_findings),
    ] {
        replace_collection(&transaction, collection, &records)?;
        mark_imported(&transaction, collection)?;
    }
    transaction.commit()?;
    Ok(receipt)
}

fn database_path() -> PathBuf {
    paths::memory_path()
        .parent()
        .expect("memory store must have a parent")
        .join("synapse.db")
}

fn repository() -> SqliteStoreRepository {
    SqliteStoreRepository {
        path: database_path(),
    }
}

fn validate_bundle(bundle: &ZhishuRepositoryBundle) -> Result<(), StoreError> {
    for record in &bundle.memory_items {
        serde_json::from_value::<super::MemoryItem>(record.clone())?;
    }
    for record in &bundle.relations {
        serde_json::from_value::<super::ZhishuRelationRecord>(record.clone())?;
    }
    for record in &bundle.maintenance_findings {
        serde_json::from_value::<super::ZhishuMaintenanceFinding>(record.clone())?;
    }
    Ok(())
}

fn read_values_at(
    database_path: &Path,
    legacy_path: &Path,
    collection: &str,
) -> Result<Vec<Value>, StoreError> {
    let mut connection = open_database(database_path)?;
    import_legacy_once(&mut connection, legacy_path, collection)?;
    let mut statement = connection
        .prepare("SELECT payload FROM store_records WHERE collection = ?1 ORDER BY ordinal ASC")?;
    let rows = statement.query_map([collection], |row| row.get::<_, String>(0))?;
    let mut records = Vec::new();
    for row in rows {
        records.push(serde_json::from_str::<Value>(&row?)?);
    }
    Ok(records)
}

fn write_values_at(
    database_path: &Path,
    collection: &str,
    records: &[Value],
) -> Result<(), StoreError> {
    let mut connection = open_database(database_path)?;
    let transaction = connection.transaction()?;
    replace_collection(&transaction, collection, records)?;
    mark_imported(&transaction, collection)?;
    transaction.commit()?;
    Ok(())
}

fn open_database(path: &Path) -> Result<Connection, StoreError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let connection = Connection::open(path)?;
    connection.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS store_records (
             collection TEXT NOT NULL,
             ordinal INTEGER NOT NULL,
             payload TEXT NOT NULL,
             PRIMARY KEY (collection, ordinal)
         );
         CREATE TABLE IF NOT EXISTS store_metadata (
             key TEXT PRIMARY KEY,
             value TEXT NOT NULL
         );",
    )?;
    Ok(connection)
}

fn import_legacy_once(
    connection: &mut Connection,
    legacy_path: &Path,
    collection: &str,
) -> Result<(), StoreError> {
    let marker = format!("legacy-imported:{collection}");
    let imported = connection
        .query_row(
            "SELECT value FROM store_metadata WHERE key = ?1",
            [&marker],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .is_some();
    if imported {
        return Ok(());
    }

    let records = read_json_records_from_file::<Value>(legacy_path)?;
    let transaction = connection.transaction()?;
    if !records.is_empty() {
        replace_collection(&transaction, collection, &records)?;
    }
    mark_imported(&transaction, collection)?;
    transaction.commit()?;
    Ok(())
}

fn replace_collection(
    transaction: &Transaction<'_>,
    collection: &str,
    records: &[Value],
) -> Result<(), StoreError> {
    transaction.execute(
        "DELETE FROM store_records WHERE collection = ?1",
        [collection],
    )?;
    let mut statement = transaction
        .prepare("INSERT INTO store_records (collection, ordinal, payload) VALUES (?1, ?2, ?3)")?;
    for (ordinal, record) in records.iter().enumerate() {
        statement.execute(params![
            collection,
            i64::try_from(ordinal).unwrap_or(i64::MAX),
            serde_json::to_string(record)?,
        ])?;
    }
    Ok(())
}

fn mark_imported(transaction: &Transaction<'_>, collection: &str) -> Result<(), StoreError> {
    transaction.execute(
        "INSERT OR REPLACE INTO store_metadata (key, value) VALUES (?1, 'true')",
        [format!("legacy-imported:{collection}")],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn temp_path(name: &str, extension: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "synapse-repository-{name}-{}.{}",
            super::super::now_millis(),
            extension
        ))
    }

    #[test]
    fn imports_legacy_json_once_and_preserves_sqlite_updates() {
        let database = temp_path("legacy", "db");
        let legacy = temp_path("legacy", "json");
        fs::write(
            &legacy,
            r#"{"schema_version":1,"records":[{"id":"legacy"}]}"#,
        )
        .unwrap();

        let first = read_values_at(&database, &legacy, MEMORY_COLLECTION).unwrap();
        fs::write(
            &legacy,
            r#"{"schema_version":1,"records":[{"id":"changed"}]}"#,
        )
        .unwrap();
        let second = read_values_at(&database, &legacy, MEMORY_COLLECTION).unwrap();

        assert_eq!(first[0]["id"], "legacy");
        assert_eq!(second[0]["id"], "legacy");

        let _ = fs::remove_file(database);
        let _ = fs::remove_file(legacy);
    }

    #[test]
    fn replaces_a_collection_transactionally() {
        let database = temp_path("replace", "db");
        let legacy = temp_path("replace", "json");
        let mut connection = open_database(&database).unwrap();
        let transaction = connection.transaction().unwrap();
        replace_collection(
            &transaction,
            RELATION_COLLECTION,
            &[serde_json::json!({"id": "new"})],
        )
        .unwrap();
        mark_imported(&transaction, RELATION_COLLECTION).unwrap();
        transaction.commit().unwrap();

        let records = read_values_at(&database, &legacy, RELATION_COLLECTION).unwrap();
        assert_eq!(records, vec![serde_json::json!({"id": "new"})]);

        let _ = fs::remove_file(database);
    }

    #[test]
    fn rejects_bundle_records_that_do_not_match_domain_types() {
        let bundle = ZhishuRepositoryBundle {
            schema_version: STORE_SCHEMA_VERSION,
            memory_items: vec![serde_json::json!({"id": "incomplete"})],
            relations: Vec::new(),
            maintenance_findings: Vec::new(),
        };

        assert!(validate_bundle(&bundle).is_err());
    }
}
