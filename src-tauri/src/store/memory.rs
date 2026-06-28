use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::audit_event::append_audit_event_at;
use crate::store::snapshot::{create_snapshot_at, get_snapshot_at};
use crate::store::{
    begin_saga, normalize_tags, now_millis, paths, read_json_records, transition_saga,
    write_json_records, AuditEvent, NewAuditEvent, SnapshotRecord, StoreError,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryItem {
    pub id: String,
    pub created_at_ms: u128,
    #[serde(default = "default_hub_area")]
    pub hub_area: String,
    pub scope: String,
    pub level: String,
    pub item_type: String,
    #[serde(default = "default_admission_state")]
    pub admission_state: String,
    #[serde(default = "default_admission_rule")]
    pub admission_rule: String,
    pub source: String,
    #[serde(default = "default_provenance")]
    pub provenance: String,
    #[serde(default = "default_source_trust")]
    pub source_trust: String,
    pub content: String,
    pub tags: Vec<String>,
    pub confidence: f64,
    pub verification: String,
    #[serde(default = "default_retention_policy")]
    pub retention_policy: String,
    #[serde(default = "default_authority")]
    pub authority: String,
    pub linked_memory_ids: Vec<String>,
    #[serde(default)]
    pub last_reinforced_at_ms: Option<u128>,
    #[serde(default)]
    pub last_invalidated_at_ms: Option<u128>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemoryRollbackReceipt {
    pub restored_item: MemoryItem,
    pub source_snapshot: SnapshotRecord,
    pub protection_snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
}

pub fn append_inspiration(content: String, tags: Vec<String>) -> Result<MemoryItem, StoreError> {
    append_memory_item_at(
        &paths::memory_path(),
        "L0 Session",
        "raw",
        "inspiration",
        "manual-capture",
        content,
        tags,
        0.5,
        "unverified",
    )
}

pub fn append_experience(
    content: String,
    tags: Vec<String>,
    experience_type: String,
) -> Result<MemoryItem, StoreError> {
    let item_type = normalize_experience_type(&experience_type);
    append_memory_item_at(
        &paths::memory_path(),
        "L1 Working",
        "reviewed-pattern",
        item_type,
        "manual-experience",
        content,
        tags,
        0.7,
        "review-accepted",
    )
}

pub fn append_zhishu_item(
    content: String,
    tags: Vec<String>,
    item_kind: String,
) -> Result<MemoryItem, StoreError> {
    let item_type = normalize_zhishu_item_kind(&item_kind);
    append_memory_item_at(
        &paths::memory_path(),
        "L2 Knowledge",
        "candidate",
        item_type,
        "manual-zhishu",
        content,
        tags,
        0.6,
        "unverified",
    )
}

pub fn append_synthesis_summary(
    content: String,
    tags: Vec<String>,
) -> Result<MemoryItem, StoreError> {
    append_memory_item_at(
        &paths::memory_path(),
        "L1 Working",
        "reviewed-summary",
        "synthesis-summary",
        "synthesis-preview",
        content,
        tags,
        0.65,
        "review-accepted",
    )
}

pub fn append_synthesis_association(
    content: String,
    tags: Vec<String>,
) -> Result<MemoryItem, StoreError> {
    append_memory_item_at(
        &paths::memory_path(),
        "L1 Working",
        "reviewed-association",
        "synthesis-association",
        "synthesis-preview",
        content,
        tags,
        0.6,
        "review-accepted",
    )
}

pub fn recent_memory_items(limit: usize) -> Result<Vec<MemoryItem>, StoreError> {
    recent_memory_items_at(&paths::memory_path(), limit)
}

pub fn review_memory_item(memory_id: String, decision: String) -> Result<MemoryItem, StoreError> {
    review_memory_item_with_protection_at(
        &paths::memory_path(),
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        memory_id,
        decision,
    )
}

pub fn rollback_memory_item_snapshot(
    snapshot_id: String,
) -> Result<MemoryRollbackReceipt, StoreError> {
    rollback_memory_item_snapshot_at(
        &paths::memory_path(),
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        snapshot_id,
    )
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn append_memory_item_at(
    path: &Path,
    scope: &str,
    level: &str,
    item_type: &str,
    source: &str,
    content: String,
    tags: Vec<String>,
    confidence: f64,
    verification: &str,
) -> Result<MemoryItem, StoreError> {
    let mut records = read_memory_items(path)?;
    let now = now_millis();
    let tags = tags_for_memory(item_type, &content, tags);
    let record = MemoryItem {
        id: format!("memory-{now}-{}", records.len() + 1),
        created_at_ms: now,
        hub_area: hub_area_for(item_type).to_string(),
        scope: scope.to_string(),
        level: level.to_string(),
        item_type: item_type.to_string(),
        admission_state: admission_state_for(verification).to_string(),
        admission_rule: admission_rule_for(item_type, source).to_string(),
        source: source.to_string(),
        provenance: provenance_for(source).to_string(),
        source_trust: source_trust_for(verification, source).to_string(),
        content,
        tags,
        confidence,
        verification: verification.to_string(),
        retention_policy: retention_policy_for(scope).to_string(),
        authority: "user-reviewable".to_string(),
        linked_memory_ids: Vec::new(),
        last_reinforced_at_ms: None,
        last_invalidated_at_ms: None,
    };

    records.insert(0, record.clone());
    records.truncate(200);
    write_json_records(path, &records)?;

    Ok(record)
}

pub(crate) fn recent_memory_items_at(
    path: &Path,
    limit: usize,
) -> Result<Vec<MemoryItem>, StoreError> {
    let mut records = read_memory_items(path)?;
    records.truncate(limit);
    Ok(records)
}

pub(crate) fn review_memory_item_at(
    path: &Path,
    memory_id: String,
    decision: String,
) -> Result<MemoryItem, StoreError> {
    let decision = normalize_memory_review_decision(&decision)?;
    let mut records = read_memory_items(path)?;
    let now = now_millis();
    let Some(record) = records.iter_mut().find(|record| record.id == memory_id) else {
        return Err(StoreError::NotFound(memory_id));
    };

    match decision {
        "accepted" => {
            record.admission_state = "accepted".to_string();
            record.verification = "review-accepted".to_string();
            if record.level == "candidate" {
                record.level = "reviewed".to_string();
            }
            record.source_trust = "reviewed-local".to_string();
            record.last_reinforced_at_ms = Some(now);
        }
        "rejected" => {
            record.admission_state = "rejected".to_string();
            record.verification = "rejected".to_string();
            record.level = "rejected".to_string();
            record.last_invalidated_at_ms = Some(now);
        }
        _ => unreachable!(),
    }

    let reviewed = record.clone();
    write_json_records(path, &records)?;
    Ok(reviewed)
}

fn review_memory_item_with_protection_at(
    memory_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    memory_id: String,
    decision: String,
) -> Result<MemoryItem, StoreError> {
    let before = memory_item_at(memory_path, &memory_id)?;
    let saga = begin_saga(
        "review-memory-item".to_string(),
        memory_id.clone(),
        serde_json::json!({ "decision": decision }),
    )?;
    let snapshot = create_snapshot_at(
        snapshot_path,
        "zhishu-item".to_string(),
        before.id.clone(),
        "before-review".to_string(),
        serde_json::to_value(&before)?,
    )
    .inspect_err(|_| mark_saga_failed(&saga.id))?;
    let reviewed = review_memory_item_at(memory_path, memory_id.clone(), decision.clone())
        .inspect_err(|_| mark_saga_failed(&saga.id))?;
    let audit_result = append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "local-user".to_string(),
            action: "review-memory-item".to_string(),
            target_type: "zhishu-item".to_string(),
            target_id: memory_id,
            risk_level: "durable-zhishu-write".to_string(),
            decision: reviewed.admission_state.clone(),
            input: serde_json::json!({
                "decision": decision,
                "snapshot_id": snapshot.id,
                "saga_id": saga.id,
            }),
            result_summary: serde_json::json!({
                "admission_state": reviewed.admission_state,
                "level": reviewed.level,
                "verification": reviewed.verification,
                "snapshot_id": snapshot.id,
                "saga_id": saga.id,
            }),
            error: None,
        },
    );

    if let Err(error) = audit_result {
        mark_saga_compensating(&saga.id);
        if let Err(compensation_error) = replace_memory_item_at(memory_path, before) {
            mark_saga_failed(&saga.id);
            return Err(compensation_error);
        }
        mark_saga_compensated(&saga.id);
        return Err(error);
    }

    transition_saga(saga.id, "committed".to_string())?;
    Ok(reviewed)
}

fn rollback_memory_item_snapshot_at(
    memory_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    snapshot_id: String,
) -> Result<MemoryRollbackReceipt, StoreError> {
    let source_snapshot = get_snapshot_at(snapshot_path, &snapshot_id)?;
    if source_snapshot.object_type != "zhishu-item" {
        return Err(StoreError::InvalidInput(format!(
            "snapshot is not a Zhishu item: {}",
            source_snapshot.object_type
        )));
    }

    let restored_item = serde_json::from_value::<MemoryItem>(source_snapshot.payload.clone())?;
    if restored_item.id != source_snapshot.object_id {
        return Err(StoreError::InvalidInput(
            "snapshot object id does not match its Zhishu payload".to_string(),
        ));
    }

    let current = memory_item_at(memory_path, &restored_item.id)?;
    let saga = begin_saga(
        "rollback-zhishu-item".to_string(),
        restored_item.id.clone(),
        serde_json::json!({ "source_snapshot_id": source_snapshot.id }),
    )?;
    let protection_snapshot = create_snapshot_at(
        snapshot_path,
        "zhishu-item".to_string(),
        current.id.clone(),
        "before-rollback".to_string(),
        serde_json::to_value(&current)?,
    )
    .inspect_err(|_| mark_saga_failed(&saga.id))?;
    replace_memory_item_at(memory_path, restored_item.clone())
        .inspect_err(|_| mark_saga_failed(&saga.id))?;

    let audit_result = append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "local-user".to_string(),
            action: "rollback-zhishu-item".to_string(),
            target_type: "zhishu-item".to_string(),
            target_id: restored_item.id.clone(),
            risk_level: "durable-zhishu-write".to_string(),
            decision: "restored".to_string(),
            input: serde_json::json!({
                "source_snapshot_id": source_snapshot.id,
                "protection_snapshot_id": protection_snapshot.id,
                "saga_id": saga.id,
            }),
            result_summary: serde_json::json!({
                "admission_state": restored_item.admission_state,
                "level": restored_item.level,
                "source_snapshot_id": source_snapshot.id,
                "protection_snapshot_id": protection_snapshot.id,
                "saga_id": saga.id,
            }),
            error: None,
        },
    );

    let audit_event = match audit_result {
        Ok(event) => event,
        Err(error) => {
            mark_saga_compensating(&saga.id);
            if let Err(compensation_error) = replace_memory_item_at(memory_path, current) {
                mark_saga_failed(&saga.id);
                return Err(compensation_error);
            }
            mark_saga_compensated(&saga.id);
            return Err(error);
        }
    };

    transition_saga(saga.id, "committed".to_string())?;
    Ok(MemoryRollbackReceipt {
        restored_item,
        source_snapshot,
        protection_snapshot,
        audit_event,
    })
}

fn mark_saga_failed(saga_id: &str) {
    let _ = transition_saga(saga_id.to_string(), "failed".to_string());
}

fn mark_saga_compensating(saga_id: &str) {
    let _ = transition_saga(saga_id.to_string(), "compensating".to_string());
}

fn mark_saga_compensated(saga_id: &str) {
    let _ = transition_saga(saga_id.to_string(), "compensated".to_string());
}

fn memory_item_at(path: &Path, memory_id: &str) -> Result<MemoryItem, StoreError> {
    read_memory_items(path)?
        .into_iter()
        .find(|record| record.id == memory_id)
        .ok_or_else(|| StoreError::NotFound(memory_id.to_string()))
}

fn replace_memory_item_at(path: &Path, replacement: MemoryItem) -> Result<(), StoreError> {
    let mut records = read_memory_items(path)?;
    let Some(record) = records
        .iter_mut()
        .find(|record| record.id == replacement.id)
    else {
        return Err(StoreError::NotFound(replacement.id));
    };
    *record = replacement;
    write_json_records(path, &records)
}

fn read_memory_items(path: &Path) -> Result<Vec<MemoryItem>, StoreError> {
    read_json_records(path)
}

fn tags_for_memory(item_type: &str, content: &str, tags: Vec<String>) -> Vec<String> {
    let mut normalized = normalize_tags(tags);
    let has_enough_user_tags = normalized.len() >= 2;
    if normalized.is_empty() {
        normalized.extend(default_tags_for_item_type(item_type));
    }
    if has_enough_user_tags {
        normalized.truncate(8);
        return normalized;
    }

    for term in extracted_content_tags(content) {
        if !normalized.iter().any(|tag| tag == &term) {
            normalized.push(term);
        }
        if normalized.len() >= 8 {
            break;
        }
    }

    normalized
}

fn default_tags_for_item_type(item_type: &str) -> Vec<String> {
    match item_type {
        "inspiration" => vec!["idea".to_string(), "inspiration".to_string()],
        "knowledge" => vec!["knowledge".to_string()],
        "reference" => vec!["knowledge".to_string(), "reference".to_string()],
        "rule" => vec!["rule".to_string()],
        "skill" => vec!["skill".to_string()],
        "skill-flow" => vec!["skill".to_string(), "skill-flow".to_string()],
        "script-interface" => vec!["script-interface".to_string(), "skill".to_string()],
        _ => Vec::new(),
    }
}

fn extracted_content_tags(content: &str) -> Vec<String> {
    let mut terms = content
        .split(|character: char| !character.is_alphanumeric())
        .map(|term| term.trim().to_ascii_lowercase())
        .filter(|term| is_useful_content_tag(term))
        .collect::<Vec<_>>();
    terms.extend(domain_content_tags(content));
    terms.sort();
    terms.dedup();
    terms.truncate(8);
    terms
}

fn domain_content_tags(content: &str) -> Vec<String> {
    [
        "司法",
        "鉴定",
        "模板",
        "记忆",
        "知识",
        "任务",
        "机会",
        "变现",
        "写作",
        "代码",
        "电脑",
        "清理",
        "交易",
        "策略",
        "智能体",
    ]
    .into_iter()
    .filter(|keyword| content.contains(keyword))
    .map(str::to_string)
    .collect()
}

fn is_useful_content_tag(term: &str) -> bool {
    if term.len() < 4 || term.len() > 24 {
        return false;
    }

    !matches!(
        term,
        "about"
            | "after"
            | "again"
            | "from"
            | "have"
            | "into"
            | "need"
            | "that"
            | "this"
            | "turn"
            | "with"
            | "without"
    )
}

fn hub_area_for(item_type: &str) -> &'static str {
    match item_type {
        "skill" | "skill-flow" | "script-interface" => "skill",
        "knowledge" | "reference" | "rule" => "knowledge",
        _ => "memory",
    }
}

fn admission_state_for(verification: &str) -> &'static str {
    match verification {
        "review-accepted" => "accepted",
        "verified" => "accepted",
        "rejected" => "rejected",
        _ => "captured",
    }
}

fn admission_rule_for(item_type: &str, source: &str) -> &'static str {
    match (item_type, source) {
        ("inspiration", "manual-capture") => "manual-l0-capture",
        ("experience-success", "manual-experience") => "experience-success-review",
        ("experience-failure", "manual-experience") => "experience-failure-review",
        ("rule-allow", "manual-experience") => "experience-allowlist-review",
        ("rule-deny", "manual-experience") => "experience-denylist-review",
        ("task-candidate", "task-center") => "task-candidate-review",
        ("rule", _) => "rule-review-required",
        ("knowledge", _) | ("reference", _) => "knowledge-review-required",
        ("skill", _) | ("skill-flow", _) | ("script-interface", _) => "skill-review-required",
        _ => "memory-review-required",
    }
}

fn provenance_for(source: &str) -> &'static str {
    match source {
        "manual-capture" => "local-user-input",
        "manual-experience" => "local-user-experience",
        "manual-zhishu" => "local-user-input",
        "task-center" => "local-task-center",
        _ => "local-runtime",
    }
}

fn source_trust_for(verification: &str, source: &str) -> &'static str {
    match (verification, source) {
        ("review-accepted", _) | ("verified", _) => "reviewed-local",
        (_, "manual-capture") => "user-provided",
        _ => "unverified-local",
    }
}

fn normalize_experience_type(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().as_str() {
        "failure" | "error" | "avoid" | "experience-failure" => "experience-failure",
        "allow" | "whitelist" | "rule-allow" => "rule-allow",
        "deny" | "blacklist" | "rule-deny" => "rule-deny",
        _ => "experience-success",
    }
}

fn normalize_zhishu_item_kind(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().as_str() {
        "reference" => "reference",
        "rule" => "rule",
        "skill" => "skill",
        "skill-flow" | "skill_flow" | "flow" => "skill-flow",
        "script-interface" | "script_interface" | "script" => "script-interface",
        _ => "knowledge",
    }
}

fn normalize_memory_review_decision(value: &str) -> Result<&'static str, StoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "accept" | "accepted" | "approve" | "approved" => Ok("accepted"),
        "reject" | "rejected" | "deny" | "denied" => Ok("rejected"),
        other => Err(StoreError::InvalidInput(format!(
            "unsupported memory review decision: {other}"
        ))),
    }
}

fn retention_policy_for(scope: &str) -> &'static str {
    match scope {
        "L2 Knowledge" => "durable-review",
        "L1 Working" => "working-review",
        _ => "session-review",
    }
}

fn default_hub_area() -> String {
    "memory".to_string()
}

fn default_admission_state() -> String {
    "captured".to_string()
}

fn default_admission_rule() -> String {
    "legacy-import-review".to_string()
}

fn default_provenance() -> String {
    "legacy-local-file".to_string()
}

fn default_source_trust() -> String {
    "legacy-unverified".to_string()
}

fn default_retention_policy() -> String {
    "session-review".to_string()
}

fn default_authority() -> String {
    "user-reviewable".to_string()
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;
    use crate::store::audit_event::list_audit_events_at;
    use crate::store::now_millis;
    use crate::store::snapshot::list_snapshots_at;

    fn temp_history_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-{name}-{}.json", now_millis()))
    }

    #[test]
    fn appends_inspiration_as_l0_memory_item() {
        let path = temp_history_path("memory");

        let item = append_memory_item_at(
            &path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "turn messy notes into a paid template".to_string(),
            vec![
                " Templates ".to_string(),
                "ideas".to_string(),
                "ideas".to_string(),
            ],
            0.5,
            "unverified",
        )
        .unwrap();

        assert_eq!(item.scope, "L0 Session");
        assert_eq!(item.hub_area, "memory");
        assert_eq!(item.level, "raw");
        assert_eq!(item.item_type, "inspiration");
        assert_eq!(item.admission_state, "captured");
        assert_eq!(item.admission_rule, "manual-l0-capture");
        assert_eq!(item.provenance, "local-user-input");
        assert_eq!(item.source_trust, "user-provided");
        assert_eq!(item.retention_policy, "session-review");
        assert_eq!(
            item.tags,
            vec!["ideas".to_string(), "templates".to_string()]
        );

        let records = recent_memory_items_at(&path, 5).unwrap();
        assert_eq!(records[0].content, "turn messy notes into a paid template");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn supplements_empty_inspiration_tags_from_content() {
        let path = temp_history_path("memory-auto-tags");

        let item = append_memory_item_at(
            &path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "Package recurring report template as paid workflow".to_string(),
            Vec::new(),
            0.5,
            "unverified",
        )
        .unwrap();

        assert!(item.tags.contains(&"package".to_string()));
        assert!(item.tags.contains(&"template".to_string()));
        assert!(item.tags.contains(&"idea".to_string()));
        assert!(item.tags.contains(&"inspiration".to_string()));
        assert!(item.tags.len() <= 8);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn supplements_chinese_inspiration_tags_from_domain_terms() {
        let path = temp_history_path("memory-chinese-tags");

        let item = append_memory_item_at(
            &path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "把司法鉴定文书模板整理成可变现的写作工具".to_string(),
            Vec::new(),
            0.5,
            "unverified",
        )
        .unwrap();

        assert!(item.tags.contains(&"司法".to_string()));
        assert!(item.tags.contains(&"鉴定".to_string()));
        assert!(item.tags.contains(&"模板".to_string()));
        assert!(item.tags.contains(&"写作".to_string()));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn reads_legacy_memory_items_with_hub_defaults() {
        let path = temp_history_path("memory-legacy");
        fs::write(
            &path,
            r#"[
              {
                "id": "memory-legacy-1",
                "created_at_ms": 1,
                "scope": "L0 Session",
                "level": "raw",
                "item_type": "inspiration",
                "source": "manual-capture",
                "content": "legacy idea",
                "tags": [],
                "confidence": 0.5,
                "verification": "unverified",
                "linked_memory_ids": []
              }
            ]"#,
        )
        .unwrap();

        let records = recent_memory_items_at(&path, 5).unwrap();

        assert_eq!(records[0].content, "legacy idea");
        assert_eq!(records[0].hub_area, "memory");
        assert_eq!(records[0].admission_state, "captured");
        assert_eq!(records[0].admission_rule, "legacy-import-review");
        assert_eq!(records[0].provenance, "legacy-local-file");
        assert_eq!(records[0].source_trust, "legacy-unverified");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn appends_reviewed_experience_records() {
        let path = temp_history_path("experience");

        let item = append_memory_item_at(
            &path,
            "L1 Working",
            "reviewed-pattern",
            normalize_experience_type("blacklist"),
            "manual-experience",
            "Do not run cleanup without dry-run preview".to_string(),
            vec!["cleanup".to_string(), "safety".to_string()],
            0.7,
            "review-accepted",
        )
        .unwrap();

        assert_eq!(item.item_type, "rule-deny");
        assert_eq!(item.admission_state, "accepted");
        assert_eq!(item.admission_rule, "experience-denylist-review");
        assert_eq!(item.provenance, "local-user-experience");
        assert_eq!(item.source_trust, "reviewed-local");
        assert_eq!(item.retention_policy, "working-review");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn appends_manual_zhishu_items_as_l2_candidates() {
        let path = temp_history_path("zhishu-item");

        let item = append_memory_item_at(
            &path,
            "L2 Knowledge",
            "candidate",
            normalize_zhishu_item_kind("script"),
            "manual-zhishu",
            "Call cleanup-helper only after dry-run approval".to_string(),
            vec!["cleanup".to_string()],
            0.6,
            "unverified",
        )
        .unwrap();

        assert_eq!(item.hub_area, "skill");
        assert_eq!(item.scope, "L2 Knowledge");
        assert_eq!(item.item_type, "script-interface");
        assert_eq!(item.admission_state, "captured");
        assert_eq!(item.admission_rule, "skill-review-required");
        assert_eq!(item.provenance, "local-user-input");
        assert_eq!(item.source_trust, "unverified-local");
        assert_eq!(item.retention_policy, "durable-review");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn supplements_empty_zhishu_tags_from_item_type() {
        let path = temp_history_path("zhishu-default-tags");

        let item = append_memory_item_at(
            &path,
            "L2 Knowledge",
            "candidate",
            normalize_zhishu_item_kind("script-interface"),
            "manual-zhishu",
            "Run helper through a guarded interface".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();

        assert!(item.tags.contains(&"script-interface".to_string()));
        assert!(item.tags.contains(&"skill".to_string()));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn reviews_memory_item_as_accepted_or_rejected() {
        let path = temp_history_path("memory-review");
        let item = append_memory_item_at(
            &path,
            "L2 Knowledge",
            "candidate",
            "knowledge",
            "manual-zhishu",
            "Useful rule candidate".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();

        let accepted = review_memory_item_at(&path, item.id.clone(), "accept".to_string()).unwrap();

        assert_eq!(accepted.admission_state, "accepted");
        assert_eq!(accepted.verification, "review-accepted");
        assert_eq!(accepted.level, "reviewed");
        assert_eq!(accepted.source_trust, "reviewed-local");
        assert_eq!(accepted.retention_policy, "durable-review");
        assert!(accepted.last_reinforced_at_ms.is_some());

        let rejected =
            review_memory_item_at(&path, item.id.clone(), "rejected".to_string()).unwrap();

        assert_eq!(rejected.admission_state, "rejected");
        assert_eq!(rejected.verification, "rejected");
        assert_eq!(rejected.level, "rejected");
        assert!(rejected.last_invalidated_at_ms.is_some());

        let _ = fs::remove_file(path);
    }

    #[test]
    fn protected_review_snapshots_and_audits_the_change() {
        let memory_path = temp_history_path("protected-review-memory");
        let snapshot_path = temp_history_path("protected-review-snapshot");
        let audit_path = temp_history_path("protected-review-audit");
        let item = append_memory_item_at(
            &memory_path,
            "L2 Knowledge",
            "candidate",
            "knowledge",
            "manual-zhishu",
            "Protected candidate".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();

        let reviewed = review_memory_item_with_protection_at(
            &memory_path,
            &snapshot_path,
            &audit_path,
            item.id.clone(),
            "accepted".to_string(),
        )
        .unwrap();

        let snapshots =
            list_snapshots_at(&snapshot_path, Some("zhishu-item"), Some(&item.id), 10).unwrap();
        let events =
            list_audit_events_at(&audit_path, Some("zhishu-item"), Some(&item.id), 10).unwrap();
        let snapshotted_item =
            serde_json::from_value::<MemoryItem>(snapshots[0].payload.clone()).unwrap();

        assert_eq!(reviewed.admission_state, "accepted");
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].reason, "before-review");
        assert_eq!(snapshotted_item.admission_state, "captured");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].action, "review-memory-item");
        let saga_id = events[0].result_summary["saga_id"].as_str().unwrap();
        let saga = crate::store::get_saga(saga_id.to_string()).unwrap();
        assert_eq!(saga.state, "committed");

        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn rollback_restores_snapshot_and_protects_current_state() {
        let memory_path = temp_history_path("rollback-memory");
        let snapshot_path = temp_history_path("rollback-snapshot");
        let audit_path = temp_history_path("rollback-audit");
        let item = append_memory_item_at(
            &memory_path,
            "L2 Knowledge",
            "candidate",
            "knowledge",
            "manual-zhishu",
            "Rollback candidate".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();
        review_memory_item_with_protection_at(
            &memory_path,
            &snapshot_path,
            &audit_path,
            item.id.clone(),
            "accepted".to_string(),
        )
        .unwrap();
        let source_snapshot =
            list_snapshots_at(&snapshot_path, Some("zhishu-item"), Some(&item.id), 10)
                .unwrap()
                .remove(0);

        let receipt = rollback_memory_item_snapshot_at(
            &memory_path,
            &snapshot_path,
            &audit_path,
            source_snapshot.id.clone(),
        )
        .unwrap();

        let current = memory_item_at(&memory_path, &item.id).unwrap();
        let snapshots =
            list_snapshots_at(&snapshot_path, Some("zhishu-item"), Some(&item.id), 10).unwrap();
        let events =
            list_audit_events_at(&audit_path, Some("zhishu-item"), Some(&item.id), 10).unwrap();

        assert_eq!(current.admission_state, "captured");
        assert_eq!(current.level, "candidate");
        assert_eq!(receipt.source_snapshot.id, source_snapshot.id);
        assert_eq!(receipt.protection_snapshot.reason, "before-rollback");
        assert_eq!(snapshots.len(), 2);
        assert_eq!(events[0].action, "rollback-zhishu-item");
        let saga_id = events[0].result_summary["saga_id"].as_str().unwrap();
        let saga = crate::store::get_saga(saga_id.to_string()).unwrap();
        assert_eq!(saga.state, "committed");

        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn audit_failure_restores_memory_after_protected_review() {
        let memory_path = temp_history_path("audit-failure-memory");
        let snapshot_path = temp_history_path("audit-failure-snapshot");
        let audit_path =
            std::env::temp_dir().join(format!("synapse-audit-failure-directory-{}", now_millis()));
        fs::create_dir(&audit_path).unwrap();
        let item = append_memory_item_at(
            &memory_path,
            "L2 Knowledge",
            "candidate",
            "knowledge",
            "manual-zhishu",
            "Audit failure candidate".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();

        let result = review_memory_item_with_protection_at(
            &memory_path,
            &snapshot_path,
            &audit_path,
            item.id.clone(),
            "accepted".to_string(),
        );
        let current = memory_item_at(&memory_path, &item.id).unwrap();

        assert!(result.is_err());
        assert_eq!(current.admission_state, "captured");
        assert_eq!(current.level, "candidate");

        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_dir(audit_path);
    }

    #[test]
    fn rejects_unknown_memory_review_decision() {
        let error = normalize_memory_review_decision("maybe").unwrap_err();

        assert!(error
            .to_string()
            .contains("unsupported memory review decision"));
    }

    #[test]
    fn reviewing_missing_memory_item_returns_not_found() {
        let path = temp_history_path("memory-review-missing");
        let error = review_memory_item_at(&path, "missing".to_string(), "accepted".to_string())
            .unwrap_err();

        assert!(error.to_string().contains("record not found"));
    }

    #[test]
    fn caps_memory_items() {
        let path = temp_history_path("memory-cap");

        for index in 0..205 {
            append_memory_item_at(
                &path,
                "L0 Session",
                "raw",
                "inspiration",
                "manual-capture",
                format!("idea {index}"),
                Vec::new(),
                0.5,
                "unverified",
            )
            .unwrap();
        }

        let records = recent_memory_items_at(&path, 300).unwrap();
        assert_eq!(records.len(), 200);
        assert_eq!(records[0].content, "idea 204");

        let _ = fs::remove_file(path);
    }
}
