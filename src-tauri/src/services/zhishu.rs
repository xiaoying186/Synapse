use crate::{store, zhishu};

pub fn search(query: zhishu::ZhishuSearchQuery) -> Result<zhishu::ZhishuSearchResponse, String> {
    zhishu::search(query).map_err(|error| format!("Zhishu search failed: {error}"))
}

pub fn generate_relations(
    query: zhishu::ZhishuSearchQuery,
) -> Result<Vec<store::ZhishuRelationRecord>, String> {
    zhishu::generate_relation_candidates(query)
        .map_err(|error| format!("Zhishu relation candidates could not be generated: {error}"))
}

pub fn relations() -> Result<Vec<store::ZhishuRelationRecord>, String> {
    store::list_zhishu_relations(false, 50)
        .map_err(|error| format!("Zhishu relations are unavailable: {error}"))
}

pub fn review_relation(
    relation_id: String,
    decision: String,
) -> Result<store::ZhishuRelationRecord, String> {
    let relation = store::review_zhishu_relation(relation_id.clone(), decision.clone())
        .map_err(|error| format!("Zhishu relation review failed: {error}"))?;
    super::audit_event::record_change(
        "review-zhishu-relation",
        "zhishu-relation",
        &relation_id,
        "durable-zhishu-write",
        &relation.review_state,
        serde_json::json!({ "decision": decision }),
        serde_json::json!({
            "source_memory_id": relation.source_memory_id,
            "target_memory_id": relation.target_memory_id,
            "relation_type": relation.relation_type,
            "review_state": relation.review_state,
        }),
    )?;
    Ok(relation)
}

pub fn scan_maintenance(
    stale_days: Option<u64>,
) -> Result<Vec<store::ZhishuMaintenanceFinding>, String> {
    zhishu::scan_maintenance(stale_days)
        .map_err(|error| format!("Zhishu maintenance scan failed: {error}"))
}

pub fn maintenance_findings() -> Result<Vec<store::ZhishuMaintenanceFinding>, String> {
    store::list_zhishu_maintenance_findings(false, 50)
        .map_err(|error| format!("Zhishu maintenance findings are unavailable: {error}"))
}

pub fn review_maintenance_finding(
    finding_id: String,
    decision: String,
) -> Result<store::ZhishuMaintenanceFinding, String> {
    let finding = store::review_zhishu_maintenance_finding(finding_id.clone(), decision.clone())
        .map_err(|error| format!("Zhishu maintenance review failed: {error}"))?;
    super::audit_event::record_change(
        "review-zhishu-maintenance-finding",
        "zhishu-maintenance-finding",
        &finding_id,
        "durable-zhishu-write",
        &finding.review_state,
        serde_json::json!({ "decision": decision }),
        serde_json::json!({
            "finding_kind": finding.finding_kind,
            "item_ids": finding.item_ids,
            "severity": finding.severity,
            "review_state": finding.review_state,
        }),
    )?;
    Ok(finding)
}

pub fn export_repository() -> Result<store::ZhishuRepositoryBundle, String> {
    store::export_zhishu_repository()
        .map_err(|error| format!("Zhishu repository export failed: {error}"))
}

pub fn import_repository(raw: String) -> Result<store::ZhishuRepositoryImportReceipt, String> {
    store::import_zhishu_repository(raw)
        .map_err(|error| format!("Zhishu repository import failed: {error}"))
}
