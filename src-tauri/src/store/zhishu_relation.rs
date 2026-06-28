use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

const MAX_RELATIONS: usize = 500;

#[derive(Debug, Clone)]
pub struct NewZhishuRelation {
    pub source_memory_id: String,
    pub target_memory_id: String,
    pub relation_type: String,
    pub reason: String,
    pub evidence: Vec<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ZhishuRelationRecord {
    pub id: String,
    pub source_memory_id: String,
    pub target_memory_id: String,
    pub relation_type: String,
    pub reason: String,
    pub evidence: Vec<String>,
    pub confidence: f64,
    pub review_state: String,
    pub created_at_ms: u128,
    #[serde(default)]
    pub reviewed_at_ms: Option<u128>,
}

pub fn append_zhishu_relations(
    relations: Vec<NewZhishuRelation>,
) -> Result<Vec<ZhishuRelationRecord>, StoreError> {
    append_zhishu_relations_at(&paths::zhishu_relation_path(), relations)
}

pub fn list_zhishu_relations(
    include_rejected: bool,
    limit: usize,
) -> Result<Vec<ZhishuRelationRecord>, StoreError> {
    list_zhishu_relations_at(&paths::zhishu_relation_path(), include_rejected, limit)
}

pub fn review_zhishu_relation(
    relation_id: String,
    decision: String,
) -> Result<ZhishuRelationRecord, StoreError> {
    review_zhishu_relation_at(&paths::zhishu_relation_path(), relation_id, decision)
}

fn append_zhishu_relations_at(
    path: &Path,
    relations: Vec<NewZhishuRelation>,
) -> Result<Vec<ZhishuRelationRecord>, StoreError> {
    let mut records = read_json_records::<ZhishuRelationRecord>(path)?;
    let now = now_millis();
    let mut created = Vec::new();
    for relation in relations {
        let (source_memory_id, target_memory_id) =
            normalized_pair(relation.source_memory_id, relation.target_memory_id)?;
        if let Some(existing) = records.iter().find(|record| {
            record.source_memory_id == source_memory_id
                && record.target_memory_id == target_memory_id
                && record.relation_type == relation.relation_type
                && record.review_state != "rejected"
        }) {
            created.push(existing.clone());
            continue;
        }
        let record = ZhishuRelationRecord {
            id: format!("zhishu-relation-{now}-{}", records.len() + 1),
            source_memory_id,
            target_memory_id,
            relation_type: required(relation.relation_type, "relation type")?,
            reason: required(relation.reason, "relation reason")?,
            evidence: relation
                .evidence
                .into_iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .take(12)
                .collect(),
            confidence: relation.confidence.clamp(0.0, 1.0),
            review_state: "candidate".to_string(),
            created_at_ms: now,
            reviewed_at_ms: None,
        };
        records.insert(0, record.clone());
        created.push(record);
    }
    records.truncate(MAX_RELATIONS);
    write_json_records(path, &records)?;
    Ok(created)
}

fn list_zhishu_relations_at(
    path: &Path,
    include_rejected: bool,
    limit: usize,
) -> Result<Vec<ZhishuRelationRecord>, StoreError> {
    let mut records = read_json_records::<ZhishuRelationRecord>(path)?
        .into_iter()
        .filter(|record| include_rejected || record.review_state != "rejected")
        .collect::<Vec<_>>();
    records.truncate(limit.min(200));
    Ok(records)
}

fn review_zhishu_relation_at(
    path: &Path,
    relation_id: String,
    decision: String,
) -> Result<ZhishuRelationRecord, StoreError> {
    let decision = match decision.trim().to_ascii_lowercase().as_str() {
        "accepted" | "accept" => "accepted",
        "rejected" | "reject" => "rejected",
        other => {
            return Err(StoreError::InvalidInput(format!(
                "unsupported Zhishu relation decision: {other}"
            )))
        }
    };
    let mut records = read_json_records::<ZhishuRelationRecord>(path)?;
    let Some(record) = records.iter_mut().find(|record| record.id == relation_id) else {
        return Err(StoreError::NotFound(relation_id));
    };
    if record.review_state != "candidate" {
        return Err(StoreError::InvalidInput(
            "Zhishu relation has already been reviewed".to_string(),
        ));
    }
    record.review_state = decision.to_string();
    record.reviewed_at_ms = Some(now_millis());
    let reviewed = record.clone();
    write_json_records(path, &records)?;
    Ok(reviewed)
}

fn normalized_pair(left: String, right: String) -> Result<(String, String), StoreError> {
    let left = required(left, "source memory id")?;
    let right = required(right, "target memory id")?;
    if left == right {
        return Err(StoreError::InvalidInput(
            "Zhishu relation cannot link an item to itself".to_string(),
        ));
    }
    if left < right {
        Ok((left, right))
    } else {
        Ok((right, left))
    }
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
    use std::fs;
    use std::path::PathBuf;

    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-relation-{name}-{}.json", now_millis()))
    }

    #[test]
    fn appends_deduplicates_and_reviews_relations() {
        let path = temp_path("review");
        let relation = NewZhishuRelation {
            source_memory_id: "memory-2".to_string(),
            target_memory_id: "memory-1".to_string(),
            relation_type: "shared-topic".to_string(),
            reason: "Shared tags".to_string(),
            evidence: vec!["template".to_string()],
            confidence: 0.7,
        };
        let first = append_zhishu_relations_at(&path, vec![relation.clone()]).unwrap();
        let second = append_zhishu_relations_at(&path, vec![relation]).unwrap();
        let reviewed =
            review_zhishu_relation_at(&path, first[0].id.clone(), "accepted".to_string()).unwrap();

        assert_eq!(first[0].source_memory_id, "memory-1");
        assert_eq!(first[0].id, second[0].id);
        assert_eq!(reviewed.review_state, "accepted");

        let _ = fs::remove_file(path);
    }
}
