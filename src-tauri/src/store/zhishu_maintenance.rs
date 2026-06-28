use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

const MAX_FINDINGS: usize = 500;

#[derive(Debug, Clone)]
pub struct NewZhishuMaintenanceFinding {
    pub finding_kind: String,
    pub item_ids: Vec<String>,
    pub reason: String,
    pub evidence: Vec<String>,
    pub severity: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ZhishuMaintenanceFinding {
    pub id: String,
    pub finding_kind: String,
    pub item_ids: Vec<String>,
    pub reason: String,
    pub evidence: Vec<String>,
    pub severity: String,
    pub review_state: String,
    pub created_at_ms: u128,
    #[serde(default)]
    pub reviewed_at_ms: Option<u128>,
}

pub fn append_zhishu_maintenance_findings(
    findings: Vec<NewZhishuMaintenanceFinding>,
) -> Result<Vec<ZhishuMaintenanceFinding>, StoreError> {
    append_findings_at(&paths::zhishu_maintenance_finding_path(), findings)
}

pub fn list_zhishu_maintenance_findings(
    include_rejected: bool,
    limit: usize,
) -> Result<Vec<ZhishuMaintenanceFinding>, StoreError> {
    list_findings_at(
        &paths::zhishu_maintenance_finding_path(),
        include_rejected,
        limit,
    )
}

pub fn review_zhishu_maintenance_finding(
    finding_id: String,
    decision: String,
) -> Result<ZhishuMaintenanceFinding, StoreError> {
    review_finding_at(
        &paths::zhishu_maintenance_finding_path(),
        finding_id,
        decision,
    )
}

fn append_findings_at(
    path: &Path,
    findings: Vec<NewZhishuMaintenanceFinding>,
) -> Result<Vec<ZhishuMaintenanceFinding>, StoreError> {
    let mut records = read_json_records::<ZhishuMaintenanceFinding>(path)?;
    let now = now_millis();
    let mut created = Vec::new();

    for finding in findings {
        let finding_kind = required(finding.finding_kind, "finding kind")?;
        let mut item_ids = finding
            .item_ids
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        item_ids.sort();
        item_ids.dedup();
        if item_ids.is_empty() {
            return Err(StoreError::InvalidInput(
                "maintenance finding requires at least one item".to_string(),
            ));
        }

        if let Some(existing) = records.iter().find(|record| {
            record.finding_kind == finding_kind
                && record.item_ids == item_ids
                && record.review_state != "rejected"
        }) {
            created.push(existing.clone());
            continue;
        }

        let severity = match finding.severity.trim().to_ascii_lowercase().as_str() {
            "low" => "low",
            "high" => "high",
            _ => "medium",
        };
        let record = ZhishuMaintenanceFinding {
            id: format!("zhishu-maintenance-{now}-{}", records.len() + 1),
            finding_kind,
            item_ids,
            reason: required(finding.reason, "finding reason")?,
            evidence: finding
                .evidence
                .into_iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .take(12)
                .collect(),
            severity: severity.to_string(),
            review_state: "candidate".to_string(),
            created_at_ms: now,
            reviewed_at_ms: None,
        };
        records.insert(0, record.clone());
        created.push(record);
    }

    records.truncate(MAX_FINDINGS);
    write_json_records(path, &records)?;
    Ok(created)
}

fn list_findings_at(
    path: &Path,
    include_rejected: bool,
    limit: usize,
) -> Result<Vec<ZhishuMaintenanceFinding>, StoreError> {
    let mut records = read_json_records::<ZhishuMaintenanceFinding>(path)?
        .into_iter()
        .filter(|record| include_rejected || record.review_state != "rejected")
        .collect::<Vec<_>>();
    records.truncate(limit.min(200));
    Ok(records)
}

fn review_finding_at(
    path: &Path,
    finding_id: String,
    decision: String,
) -> Result<ZhishuMaintenanceFinding, StoreError> {
    let decision = match decision.trim().to_ascii_lowercase().as_str() {
        "accepted" | "accept" => "accepted",
        "rejected" | "reject" => "rejected",
        other => {
            return Err(StoreError::InvalidInput(format!(
                "unsupported Zhishu maintenance decision: {other}"
            )))
        }
    };
    let mut records = read_json_records::<ZhishuMaintenanceFinding>(path)?;
    let Some(record) = records.iter_mut().find(|record| record.id == finding_id) else {
        return Err(StoreError::NotFound(finding_id));
    };
    if record.review_state != "candidate" {
        return Err(StoreError::InvalidInput(
            "Zhishu maintenance finding has already been reviewed".to_string(),
        ));
    }

    record.review_state = decision.to_string();
    record.reviewed_at_ms = Some(now_millis());
    let reviewed = record.clone();
    write_json_records(path, &records)?;
    Ok(reviewed)
}

fn required(value: String, label: &str) -> Result<String, StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(StoreError::InvalidInput(format!("{label} cannot be empty")));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-maintenance-{name}-{}.json", now_millis()))
    }

    #[test]
    fn deduplicates_active_findings_and_reviews_them() {
        let path = temp_path("review");
        let finding = NewZhishuMaintenanceFinding {
            finding_kind: "duplicate".to_string(),
            item_ids: vec!["memory-2".to_string(), "memory-1".to_string()],
            reason: "Same normalized content".to_string(),
            evidence: vec!["same text".to_string()],
            severity: "medium".to_string(),
        };

        let first = append_findings_at(&path, vec![finding.clone()]).unwrap();
        let second = append_findings_at(&path, vec![finding]).unwrap();
        let reviewed =
            review_finding_at(&path, first[0].id.clone(), "accepted".to_string()).unwrap();

        assert_eq!(first[0].item_ids, vec!["memory-1", "memory-2"]);
        assert_eq!(first[0].id, second[0].id);
        assert_eq!(reviewed.review_state, "accepted");

        let _ = fs::remove_file(path);
    }
}
