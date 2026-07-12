use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::memory::{append_memory_item_at, recent_memory_items_at, MemoryItem};
use crate::store::task_artifact::{append_task_artifacts_at, NewTaskArtifact, TaskArtifactRecord};
use crate::store::{
    normalize_tags, now_millis, paths, read_json_records, short_text, write_json_records,
    StoreError,
};

const MIN_CANDIDATE_SCORE: f64 = 0.35;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDirection {
    pub id: String,
    pub created_at_ms: u128,
    pub updated_at_ms: u128,
    pub title: String,
    pub description: String,
    pub priority: u8,
    pub active: bool,
    pub keywords: Vec<String>,
    #[serde(default = "default_schedule_frequency")]
    pub schedule_frequency: String,
    #[serde(default)]
    pub online_enabled: bool,
    #[serde(default = "default_output_template")]
    pub output_template: String,
    #[serde(default)]
    pub push_enabled: bool,
    #[serde(default)]
    pub push_channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCandidate {
    pub id: String,
    pub created_at_ms: u128,
    pub task_direction_id: String,
    pub task_direction_title: String,
    pub memory_item_id: String,
    pub summary: String,
    pub score: f64,
    #[serde(default)]
    pub score_components: TaskCandidateScoreComponents,
    pub matched_keywords: Vec<String>,
    #[serde(default)]
    pub evidence: Vec<TaskCandidateEvidence>,
    pub explanation: String,
    pub status: String,
    #[serde(default)]
    pub reviewed_at_ms: Option<u128>,
    #[serde(default)]
    pub review_decision: Option<String>,
    #[serde(default)]
    pub promoted_memory_id: Option<String>,
    #[serde(default)]
    pub source_candidate_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskCandidateScoreComponents {
    #[serde(default)]
    pub keyword_score: f64,
    #[serde(default)]
    pub priority_score: f64,
    #[serde(default)]
    pub memory_confidence: f64,
    #[serde(default)]
    pub final_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskCandidateEvidence {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCandidateReview {
    pub candidate: TaskCandidate,
    pub promoted_memory_item: Option<MemoryItem>,
    #[serde(default)]
    pub follow_up_run: Option<TaskRunRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSchedulePreview {
    pub direction_id: String,
    pub direction_title: String,
    pub frequency: String,
    pub next_run_at_ms: Option<u128>,
    pub next_run_label: String,
    pub readiness: String,
    pub detail: String,
    pub requires_network: bool,
    pub output_template: String,
    pub push_enabled: bool,
    pub push_channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRunRecord {
    pub id: String,
    pub created_at_ms: u128,
    pub task_direction_id: String,
    pub task_direction_title: String,
    pub trigger_kind: String,
    #[serde(default)]
    pub idempotency_key: String,
    pub schedule_frequency: String,
    pub online_enabled: bool,
    pub output_template: String,
    #[serde(default)]
    pub push_enabled: bool,
    #[serde(default)]
    pub push_channels: Vec<String>,
    #[serde(default)]
    pub lifecycle_state: String,
    pub approval_state: String,
    pub execution_state: String,
    pub detail: String,
    #[serde(default)]
    pub generated_candidate_ids: Vec<String>,
    #[serde(default)]
    pub started_at_ms: Option<u128>,
    #[serde(default)]
    pub completed_at_ms: Option<u128>,
    #[serde(default)]
    pub failed_at_ms: Option<u128>,
    #[serde(default)]
    pub error_summary: Option<String>,
    #[serde(default)]
    pub cancelled_at_ms: Option<u128>,
    #[serde(default)]
    pub archived_at_ms: Option<u128>,
    #[serde(default)]
    pub source_candidate_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TaskRunTransition {
    Approve,
    Reject,
    Start,
    Block,
    Complete,
    Fail,
    Cancel,
    Archive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSchedulerTick {
    pub generated_at_ms: u128,
    pub created_run_count: usize,
    pub skipped_run_count: usize,
    pub created_runs: Vec<TaskRunRecord>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRunExecutionReceipt {
    pub run: TaskRunRecord,
    pub generated_candidates: Vec<TaskCandidate>,
    pub artifacts: Vec<TaskArtifactRecord>,
}

pub fn append_task_direction(
    title: String,
    description: String,
    priority: u8,
    keywords: Vec<String>,
    schedule_frequency: String,
    online_enabled: bool,
    push_enabled: bool,
    push_channels: Vec<String>,
    output_template: String,
) -> Result<TaskDirection, StoreError> {
    append_task_direction_with_push_at(
        &paths::task_direction_path(),
        title,
        description,
        priority,
        keywords,
        schedule_frequency,
        online_enabled,
        push_enabled,
        push_channels,
        output_template,
    )
}

pub fn task_directions(limit: usize) -> Result<Vec<TaskDirection>, StoreError> {
    task_directions_at(&paths::task_direction_path(), limit)
}

pub fn set_task_direction_active(
    direction_id: String,
    active: bool,
) -> Result<TaskDirection, StoreError> {
    set_task_direction_active_at(&paths::task_direction_path(), direction_id, active)
}

pub fn restore_task_direction(record: TaskDirection) -> Result<TaskDirection, StoreError> {
    restore_task_direction_at(&paths::task_direction_path(), record)
}

pub fn task_schedule_previews(limit: usize) -> Result<Vec<TaskSchedulePreview>, StoreError> {
    task_schedule_previews_with_runs_at(
        &paths::task_direction_path(),
        &paths::task_run_path(),
        limit,
    )
}

pub fn generate_task_candidates() -> Result<Vec<TaskCandidate>, StoreError> {
    generate_task_candidates_at(
        &paths::task_candidate_path(),
        &paths::task_direction_path(),
        &paths::memory_path(),
    )
}

pub fn task_candidates(limit: usize) -> Result<Vec<TaskCandidate>, StoreError> {
    task_candidates_at(&paths::task_candidate_path(), limit)
}

pub fn request_task_run(direction_id: String) -> Result<TaskRunRecord, StoreError> {
    request_task_run_at(
        &paths::task_run_path(),
        &paths::task_direction_path(),
        direction_id,
    )
}

pub fn task_run_records(limit: usize) -> Result<Vec<TaskRunRecord>, StoreError> {
    task_run_records_at(&paths::task_run_path(), limit)
}

pub fn task_run_by_id(run_id: String) -> Result<TaskRunRecord, StoreError> {
    let run_id = run_id.trim().to_string();
    if run_id.is_empty() {
        return Err(StoreError::InvalidInput(
            "task run id cannot be empty".to_string(),
        ));
    }
    read_task_run_records(&paths::task_run_path())?
        .into_iter()
        .find(|record| record.id == run_id)
        .ok_or(StoreError::NotFound(run_id))
}

pub fn recover_interrupted_task_runs() -> Result<Vec<TaskRunRecord>, StoreError> {
    recover_interrupted_task_runs_at(&paths::task_run_path(), now_millis())
}

pub fn review_task_run(run_id: String, approved: bool) -> Result<TaskRunRecord, StoreError> {
    review_task_run_at(&paths::task_run_path(), run_id, approved)
}

pub fn cancel_task_run(run_id: String) -> Result<TaskRunRecord, StoreError> {
    transition_task_run_at(&paths::task_run_path(), run_id, TaskRunTransition::Cancel)
}

pub fn archive_task_run(run_id: String) -> Result<TaskRunRecord, StoreError> {
    transition_task_run_at(&paths::task_run_path(), run_id, TaskRunTransition::Archive)
}

pub fn task_scheduler_tick() -> Result<TaskSchedulerTick, StoreError> {
    task_scheduler_tick_at(&paths::task_run_path(), &paths::task_direction_path())
}

pub fn execute_task_run(run_id: String) -> Result<TaskRunExecutionReceipt, StoreError> {
    execute_task_run_at(
        &paths::task_run_path(),
        &paths::task_candidate_path(),
        &paths::task_artifact_path(),
        &paths::task_direction_path(),
        &paths::memory_path(),
        run_id,
    )
}

pub fn complete_domain_task_run(
    run_id: String,
    detail: String,
) -> Result<TaskRunRecord, StoreError> {
    let path = paths::task_run_path();
    let mut records = read_task_run_records(&path)?;
    let Some(record) = records.iter_mut().find(|record| record.id == run_id) else {
        return Err(StoreError::NotFound(run_id));
    };
    transition_task_run(record, TaskRunTransition::Start)?;
    record.started_at_ms = Some(now_millis());
    transition_task_run(record, TaskRunTransition::Complete)?;
    record.completed_at_ms = Some(now_millis());
    record.detail = detail.trim().to_string();
    record.error_summary = None;
    let completed = record.clone();
    write_json_records(&path, &records)?;
    Ok(completed)
}

pub fn restore_task_run(record: TaskRunRecord) -> Result<TaskRunRecord, StoreError> {
    let path = paths::task_run_path();
    let mut records = read_task_run_records(&path)?;
    let Some(index) = records.iter().position(|existing| existing.id == record.id) else {
        return Err(StoreError::NotFound(record.id));
    };
    records[index] = record.clone();
    write_json_records(&path, &records)?;
    Ok(record)
}

pub fn review_task_candidate(
    candidate_id: String,
    decision: String,
) -> Result<TaskCandidateReview, StoreError> {
    review_task_candidate_at(
        &paths::task_candidate_path(),
        &paths::task_run_path(),
        &paths::memory_path(),
        candidate_id,
        decision,
    )
}

#[cfg(test)]
fn append_task_direction_at(
    path: &Path,
    title: String,
    description: String,
    priority: u8,
    keywords: Vec<String>,
    schedule_frequency: String,
    online_enabled: bool,
    output_template: String,
) -> Result<TaskDirection, StoreError> {
    append_task_direction_with_push_at(
        path,
        title,
        description,
        priority,
        keywords,
        schedule_frequency,
        online_enabled,
        false,
        Vec::new(),
        output_template,
    )
}

fn append_task_direction_with_push_at(
    path: &Path,
    title: String,
    description: String,
    priority: u8,
    keywords: Vec<String>,
    schedule_frequency: String,
    online_enabled: bool,
    push_enabled: bool,
    push_channels: Vec<String>,
    output_template: String,
) -> Result<TaskDirection, StoreError> {
    let mut records = read_task_directions(path)?;
    let now = now_millis();
    let push_channels = normalize_push_channels(push_channels);
    let record = TaskDirection {
        id: format!("task-direction-{now}-{}", records.len() + 1),
        created_at_ms: now,
        updated_at_ms: now,
        title,
        description,
        priority: priority.clamp(1, 5),
        active: true,
        keywords: normalize_tags(keywords),
        schedule_frequency: normalize_schedule_frequency(schedule_frequency),
        online_enabled,
        output_template: normalize_output_template(output_template),
        push_enabled: push_enabled && !push_channels.is_empty(),
        push_channels,
    };

    records.insert(0, record.clone());
    records.truncate(50);
    write_json_records(path, &records)?;

    Ok(record)
}

fn task_directions_at(path: &Path, limit: usize) -> Result<Vec<TaskDirection>, StoreError> {
    let mut records = read_task_directions(path)?;
    records.sort_by(|left, right| {
        right
            .priority
            .cmp(&left.priority)
            .then_with(|| right.updated_at_ms.cmp(&left.updated_at_ms))
    });
    records.truncate(limit);
    Ok(records)
}

fn set_task_direction_active_at(
    path: &Path,
    direction_id: String,
    active: bool,
) -> Result<TaskDirection, StoreError> {
    let mut records = read_task_directions(path)?;
    let Some(index) = records.iter().position(|record| record.id == direction_id) else {
        return Err(StoreError::NotFound(direction_id));
    };

    records[index].active = active;
    records[index].updated_at_ms = now_millis();
    let record = records[index].clone();
    write_json_records(path, &records)?;

    Ok(record)
}

fn restore_task_direction_at(
    path: &Path,
    mut restored: TaskDirection,
) -> Result<TaskDirection, StoreError> {
    let mut records = read_task_directions(path)?;
    let Some(index) = records.iter().position(|record| record.id == restored.id) else {
        return Err(StoreError::NotFound(restored.id));
    };

    restored.updated_at_ms = now_millis();
    records[index] = restored.clone();
    write_json_records(path, &records)?;
    Ok(restored)
}

#[cfg(test)]
fn task_schedule_previews_at(
    path: &Path,
    limit: usize,
) -> Result<Vec<TaskSchedulePreview>, StoreError> {
    let now = now_millis();
    let previews = task_directions_at(path, limit)?
        .into_iter()
        .map(|direction| schedule_preview_for_direction(&direction, now))
        .collect();

    Ok(previews)
}

fn task_schedule_previews_with_runs_at(
    direction_path: &Path,
    run_path: &Path,
    limit: usize,
) -> Result<Vec<TaskSchedulePreview>, StoreError> {
    let now = now_millis();
    let records = read_task_run_records(run_path)?;
    let previews = task_directions_at(direction_path, limit)?
        .into_iter()
        .map(|direction| schedule_preview_for_direction_with_runs(&direction, &records, now))
        .collect();

    Ok(previews)
}

fn generate_task_candidates_at(
    candidate_path: &Path,
    direction_path: &Path,
    memory_path: &Path,
) -> Result<Vec<TaskCandidate>, StoreError> {
    let directions = task_directions_at(direction_path, 50)?
        .into_iter()
        .filter(|direction| direction.active)
        .collect::<Vec<_>>();
    let memories = recent_memory_items_at(memory_path, 100)?
        .into_iter()
        .filter(|memory| memory.admission_state != "rejected")
        .collect::<Vec<_>>();
    let mut generated = Vec::new();

    for direction in &directions {
        generated.extend(candidates_for_direction(direction, &memories));
    }

    persist_generated_candidates(candidate_path, generated, 25)
}

fn task_candidates_at(path: &Path, limit: usize) -> Result<Vec<TaskCandidate>, StoreError> {
    let mut records = read_task_candidates(path)?;
    records.sort_by(|left, right| {
        right.created_at_ms.cmp(&left.created_at_ms).then_with(|| {
            right
                .score
                .partial_cmp(&left.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    });
    records.truncate(limit);
    Ok(records)
}

fn review_task_candidate_at(
    candidate_path: &Path,
    run_path: &Path,
    memory_path: &Path,
    candidate_id: String,
    decision: String,
) -> Result<TaskCandidateReview, StoreError> {
    let decision = decision.trim().to_ascii_lowercase();
    if !matches!(decision.as_str(), "accepted" | "rejected" | "deepen") {
        return Err(StoreError::InvalidInput(format!(
            "unsupported task candidate decision: {decision}"
        )));
    }

    let mut candidates = read_task_candidates(candidate_path)?;
    let Some(index) = candidates.iter().position(|item| item.id == candidate_id) else {
        return Err(StoreError::NotFound(candidate_id));
    };

    let mut promoted_memory_item = None;
    let mut follow_up_run = None;
    if decision == "accepted" && candidates[index].promoted_memory_id.is_none() {
        let content = candidate_promotion_content(&candidates[index]);
        let tags = candidate_promotion_tags(&candidates[index]);
        promoted_memory_item = Some(append_memory_item_at(
            memory_path,
            "L1 Working",
            "candidate",
            "task-candidate",
            "task-center",
            content,
            tags,
            candidates[index].score,
            "review-accepted",
        )?);
    }

    if decision == "deepen" {
        follow_up_run = Some(append_candidate_deepen_run(run_path, &candidates[index])?);
    }

    let reviewed_at_ms = now_millis();
    let candidate = &mut candidates[index];
    candidate.status = match decision.as_str() {
        "accepted" => "accepted".to_string(),
        "rejected" => "rejected".to_string(),
        _ => "needs-deepening".to_string(),
    };
    candidate.review_decision = Some(decision);
    candidate.reviewed_at_ms = Some(reviewed_at_ms);
    if let Some(item) = &promoted_memory_item {
        candidate.promoted_memory_id = Some(item.id.clone());
    }

    let candidate = candidate.clone();
    write_task_candidates(candidate_path, &candidates)?;

    Ok(TaskCandidateReview {
        candidate,
        promoted_memory_item,
        follow_up_run,
    })
}

fn candidate_promotion_content(candidate: &TaskCandidate) -> String {
    let mut content = match candidate.source_candidate_id.as_deref() {
        Some(source_candidate_id) => {
            format!(
                "{}\nSource candidate: {source_candidate_id}",
                candidate.summary
            )
        }
        None => candidate.summary.clone(),
    };

    if let Some(template) = candidate_evidence_value(candidate, "Resolved output template") {
        content.push_str(&format!("\nResolved output template: {template}"));
    }

    content
}

fn candidate_evidence_value<'a>(candidate: &'a TaskCandidate, label: &str) -> Option<&'a str> {
    candidate
        .evidence
        .iter()
        .find(|item| item.label == label)
        .map(|item| item.value.as_str())
}

fn candidate_promotion_tags(candidate: &TaskCandidate) -> Vec<String> {
    let mut tags = candidate.matched_keywords.clone();
    if let Some(template) = candidate_evidence_value(candidate, "Resolved output template") {
        tags.push(format!("template:{template}"));
    }
    if let Some(source_candidate_id) = &candidate.source_candidate_id {
        tags.push(format!("source-candidate:{source_candidate_id}"));
    }
    tags
}

fn append_candidate_deepen_run(
    run_path: &Path,
    candidate: &TaskCandidate,
) -> Result<TaskRunRecord, StoreError> {
    let mut records = read_task_run_records(run_path)?;
    let idempotency_key = format!("candidate-deepen:{}", candidate.id);
    if let Some(existing) = records
        .iter()
        .find(|record| record.idempotency_key == idempotency_key)
    {
        return Ok(existing.clone());
    }

    let now = now_millis();
    let record = TaskRunRecord {
        id: format!("task-run-{now}-{}", records.len() + 1),
        created_at_ms: now,
        task_direction_id: candidate.task_direction_id.clone(),
        task_direction_title: candidate.task_direction_title.clone(),
        trigger_kind: "candidate-deepen".to_string(),
        idempotency_key,
        schedule_frequency: "manual".to_string(),
        online_enabled: false,
        output_template: "brief".to_string(),
        push_enabled: false,
        push_channels: Vec::new(),
        lifecycle_state: "awaiting-approval".to_string(),
        approval_state: "waiting-approval".to_string(),
        execution_state: "not-started".to_string(),
        detail: format!(
            "Follow-up run requested to deepen candidate {} before any execution.",
            candidate.id
        ),
        generated_candidate_ids: Vec::new(),
        started_at_ms: None,
        completed_at_ms: None,
        failed_at_ms: None,
        error_summary: None,
        cancelled_at_ms: None,
        archived_at_ms: None,
        source_candidate_id: Some(candidate.id.clone()),
    };

    records.insert(0, record.clone());
    records.truncate(100);
    write_json_records(run_path, &records)?;

    Ok(record)
}

fn request_task_run_at(
    run_path: &Path,
    direction_path: &Path,
    direction_id: String,
) -> Result<TaskRunRecord, StoreError> {
    let directions = read_task_directions(direction_path)?;
    let Some(direction) = directions.iter().find(|item| item.id == direction_id) else {
        return Err(StoreError::NotFound(direction_id));
    };
    if !direction.active {
        return Err(StoreError::InvalidInput(
            "task direction is inactive".to_string(),
        ));
    }

    let mut records = read_task_run_records(run_path)?;
    if let Some(existing) = records
        .iter()
        .find(|record| is_open_direction_run(record, &direction.id))
    {
        return Ok(existing.clone());
    }

    let now = now_millis();
    let record = build_task_run_record(direction, now, records.len() + 1, "manual-request");

    records.insert(0, record.clone());
    records.truncate(100);
    write_json_records(run_path, &records)?;

    Ok(record)
}

fn task_scheduler_tick_at(
    run_path: &Path,
    direction_path: &Path,
) -> Result<TaskSchedulerTick, StoreError> {
    let directions = read_task_directions(direction_path)?;
    let mut records = read_task_run_records(run_path)?;
    let now = now_millis();
    let mut created_runs = Vec::new();
    let mut skipped_run_count = 0;

    for direction in directions.iter().filter(|direction| direction.active) {
        let preview = schedule_preview_for_direction(direction, now);
        if preview.readiness != "ready-preview" {
            skipped_run_count += 1;
            continue;
        }

        if has_open_run(&records, &direction.id)
            || completed_within_current_interval(&records, direction, now)
        {
            skipped_run_count += 1;
            continue;
        }

        let idempotency_key = task_run_idempotency_key(direction, "schedule-tick", now, 0);
        if records
            .iter()
            .any(|record| record.idempotency_key == idempotency_key)
        {
            skipped_run_count += 1;
            continue;
        }

        let record = build_task_run_record(
            direction,
            now,
            records.len() + created_runs.len() + 1,
            "schedule-tick",
        );
        created_runs.push(record.clone());
        records.insert(0, record);
    }

    records.truncate(100);
    write_json_records(run_path, &records)?;

    Ok(TaskSchedulerTick {
        generated_at_ms: now,
        created_run_count: created_runs.len(),
        skipped_run_count,
        created_runs,
        detail: "Scheduler tick preview recorded due runs only; no execution was started."
            .to_string(),
    })
}

fn task_run_records_at(path: &Path, limit: usize) -> Result<Vec<TaskRunRecord>, StoreError> {
    let mut records = read_task_run_records(path)?;
    records.sort_by(|left, right| right.created_at_ms.cmp(&left.created_at_ms));
    records.truncate(limit);
    Ok(records)
}

fn recover_interrupted_task_runs_at(
    path: &Path,
    recovered_at_ms: u128,
) -> Result<Vec<TaskRunRecord>, StoreError> {
    let mut records = read_task_run_records(path)?;
    let mut recovered = Vec::new();
    for record in records
        .iter_mut()
        .filter(|record| effective_lifecycle_state(record) == "running")
    {
        transition_task_run(record, TaskRunTransition::Fail)?;
        record.failed_at_ms = Some(recovered_at_ms);
        record.error_summary =
            Some("Previous process ended while this Task Run was running.".to_string());
        record.detail =
            "Task Run was recovered as failed after an interrupted process.".to_string();
        recovered.push(record.clone());
    }

    if !recovered.is_empty() {
        write_json_records(path, &records)?;
    }
    Ok(recovered)
}

fn review_task_run_at(
    path: &Path,
    run_id: String,
    approved: bool,
) -> Result<TaskRunRecord, StoreError> {
    let mut records = read_task_run_records(path)?;
    let Some(index) = records.iter().position(|record| record.id == run_id) else {
        return Err(StoreError::NotFound(run_id));
    };

    let record = &mut records[index];
    transition_task_run(
        record,
        if approved {
            TaskRunTransition::Approve
        } else {
            TaskRunTransition::Reject
        },
    )?;
    if approved {
        record.detail = if record.trigger_kind == "candidate-deepen" {
            "Candidate deepening approved for the local executor; no execution was started."
                .to_string()
        } else {
            "Run request approved for a future scheduler or executor; no execution was started."
                .to_string()
        };
    } else {
        record.detail = if record.trigger_kind == "candidate-deepen" {
            "Candidate deepening rejected and blocked before execution.".to_string()
        } else {
            "Run request rejected and blocked before execution.".to_string()
        };
    }

    let record = record.clone();
    write_json_records(path, &records)?;

    Ok(record)
}

fn transition_task_run_at(
    path: &Path,
    run_id: String,
    transition: TaskRunTransition,
) -> Result<TaskRunRecord, StoreError> {
    let mut records = read_task_run_records(path)?;
    let Some(index) = records.iter().position(|record| record.id == run_id) else {
        return Err(StoreError::NotFound(run_id));
    };

    transition_task_run(&mut records[index], transition)?;
    let now = now_millis();
    match transition {
        TaskRunTransition::Cancel => {
            records[index].cancelled_at_ms = Some(now);
            records[index].detail = "Task run was cancelled before further execution.".to_string();
        }
        TaskRunTransition::Archive => {
            records[index].archived_at_ms = Some(now);
            records[index].detail = "Task run was archived as a terminal record.".to_string();
        }
        _ => {}
    }
    let record = records[index].clone();
    write_json_records(path, &records)?;
    Ok(record)
}

fn execute_task_run_at(
    run_path: &Path,
    candidate_path: &Path,
    artifact_path: &Path,
    direction_path: &Path,
    memory_path: &Path,
    run_id: String,
) -> Result<TaskRunExecutionReceipt, StoreError> {
    let mut records = read_task_run_records(run_path)?;
    let Some(index) = records.iter().position(|record| record.id == run_id) else {
        return Err(StoreError::NotFound(run_id));
    };

    let run = records[index].clone();
    if run.approval_state != "approved" {
        return Err(StoreError::InvalidInput(
            "task run must be approved before execution".to_string(),
        ));
    }

    if run.online_enabled {
        transition_task_run(&mut records[index], TaskRunTransition::Block)?;
        records[index].detail =
            "Online task runs remain blocked until real retrieval gates are implemented."
                .to_string();
        let blocked = records[index].clone();
        write_json_records(run_path, &records)?;
        return Ok(TaskRunExecutionReceipt {
            run: blocked,
            generated_candidates: Vec::new(),
            artifacts: Vec::new(),
        });
    }

    if run.execution_state == "completed" {
        return Err(StoreError::InvalidInput(
            "task run has already completed".to_string(),
        ));
    }

    if run.execution_state != "approved-not-started" {
        return Err(StoreError::InvalidInput(format!(
            "task run is not ready for local execution: {}",
            run.execution_state
        )));
    }

    let directions = read_task_directions(direction_path)?;
    let Some(direction) = directions
        .iter()
        .find(|direction| direction.id == run.task_direction_id)
    else {
        return Err(StoreError::NotFound(run.task_direction_id));
    };

    if !direction.active {
        return Err(StoreError::InvalidInput(
            "task direction is inactive".to_string(),
        ));
    }

    let source_candidate_id = if run.trigger_kind == "candidate-deepen" {
        let Some(source_candidate_id) = run.source_candidate_id.clone() else {
            return Err(StoreError::InvalidInput(
                "candidate deepen run is missing a source candidate".to_string(),
            ));
        };
        Some(source_candidate_id)
    } else {
        None
    };

    transition_task_run(&mut records[index], TaskRunTransition::Start)?;
    records[index].started_at_ms = Some(now_millis());
    records[index].detail = "Local executor started this run.".to_string();
    write_json_records(run_path, &records)?;

    let execution_result = if let Some(source_candidate_id) = source_candidate_id {
        candidates_for_source_candidate(candidate_path, &source_candidate_id).and_then(
            |candidates| {
                persist_generated_candidates(candidate_path, candidates, 25).map(|generated| {
                    (
                        generated,
                        "Local executor completed candidate deepening and generated".to_string(),
                    )
                })
            },
        )
    } else {
        recent_memory_items_at(memory_path, 100).and_then(|memories| {
            persist_generated_candidates(
                candidate_path,
                candidates_for_direction(direction, &memories),
                25,
            )
            .map(|generated| {
                (
                    generated,
                    "Local executor completed internal candidate mining and generated".to_string(),
                )
            })
        })
    };

    let (generated, execution_detail) = match execution_result {
        Ok(result) => result,
        Err(error) => {
            transition_task_run(&mut records[index], TaskRunTransition::Fail)?;
            records[index].failed_at_ms = Some(now_millis());
            records[index].error_summary = Some(short_text(&error.to_string(), 240));
            records[index].detail =
                "Local executor failed; inspect the stored error summary.".to_string();
            write_json_records(run_path, &records)?;
            return Err(error);
        }
    };

    let artifacts = append_task_artifacts_at(
        artifact_path,
        run.id.clone(),
        run.task_direction_id.clone(),
        generated
            .iter()
            .map(|candidate| NewTaskArtifact {
                artifact_type: "task-candidate".to_string(),
                reference_id: candidate.id.clone(),
                title: candidate.task_direction_title.clone(),
                summary: candidate.summary.clone(),
                metadata: serde_json::json!({
                    "score": candidate.score,
                    "status": candidate.status,
                    "source_candidate_id": candidate.source_candidate_id,
                }),
            })
            .collect(),
    );
    let artifacts = match artifacts {
        Ok(artifacts) => artifacts,
        Err(error) => {
            let generated_ids = generated
                .iter()
                .map(|candidate| candidate.id.clone())
                .collect::<Vec<_>>();
            remove_task_candidates_by_ids(candidate_path, &generated_ids)?;
            transition_task_run(&mut records[index], TaskRunTransition::Fail)?;
            records[index].failed_at_ms = Some(now_millis());
            records[index].error_summary = Some(short_text(&error.to_string(), 240));
            records[index].detail =
                "Local executor produced output, but artifact indexing failed.".to_string();
            write_json_records(run_path, &records)?;
            return Err(error);
        }
    };

    transition_task_run(&mut records[index], TaskRunTransition::Complete)?;
    records[index].completed_at_ms = Some(now_millis());
    records[index].error_summary = None;
    records[index].generated_candidate_ids = generated
        .iter()
        .map(|candidate| candidate.id.clone())
        .collect();
    records[index].detail = format!(
        "{execution_detail} {} candidate{}.",
        generated.len(),
        if generated.len() == 1 { "" } else { "s" }
    );
    let run = records[index].clone();
    write_json_records(run_path, &records)?;

    Ok(TaskRunExecutionReceipt {
        run,
        generated_candidates: generated,
        artifacts,
    })
}

fn build_task_run_record(
    direction: &TaskDirection,
    now: u128,
    sequence: usize,
    trigger_kind: &str,
) -> TaskRunRecord {
    TaskRunRecord {
        id: format!("task-run-{now}-{sequence}"),
        created_at_ms: now,
        task_direction_id: direction.id.clone(),
        task_direction_title: direction.title.clone(),
        trigger_kind: trigger_kind.to_string(),
        idempotency_key: task_run_idempotency_key(direction, trigger_kind, now, sequence),
        schedule_frequency: direction.schedule_frequency.clone(),
        online_enabled: direction.online_enabled,
        output_template: direction.output_template.clone(),
        push_enabled: direction.push_enabled,
        push_channels: direction.push_channels.clone(),
        lifecycle_state: "awaiting-approval".to_string(),
        approval_state: "waiting-approval".to_string(),
        execution_state: "not-started".to_string(),
        detail: "Run request recorded only. Future scheduled execution must pass approval and policy gates."
            .to_string(),
        generated_candidate_ids: Vec::new(),
        started_at_ms: None,
        completed_at_ms: None,
        failed_at_ms: None,
        error_summary: None,
        cancelled_at_ms: None,
        archived_at_ms: None,
        source_candidate_id: None,
    }
}

fn has_open_run(records: &[TaskRunRecord], direction_id: &str) -> bool {
    records
        .iter()
        .any(|record| is_open_direction_run(record, direction_id))
}

fn is_open_direction_run(record: &TaskRunRecord, direction_id: &str) -> bool {
    record.task_direction_id == direction_id
        && record.trigger_kind != "candidate-deepen"
        && record.source_candidate_id.is_none()
        && matches!(
            effective_lifecycle_state(record),
            "awaiting-approval" | "approved" | "running"
        )
}

fn completed_within_current_interval(
    records: &[TaskRunRecord],
    direction: &TaskDirection,
    now: u128,
) -> bool {
    let Some(interval_ms) = schedule_interval_ms(&direction.schedule_frequency) else {
        return false;
    };

    records.iter().any(|record| {
        is_completed_direction_run(record, &direction.id)
            && record
                .completed_at_ms
                .map(|completed_at_ms| now.saturating_sub(completed_at_ms) < interval_ms)
                .unwrap_or(false)
    })
}

fn schedule_interval_ms(frequency: &str) -> Option<u128> {
    match frequency {
        "daily" => Some(24 * 60 * 60 * 1000),
        "weekly" => Some(7 * 24 * 60 * 60 * 1000),
        _ => custom_interval(frequency).map(|interval| interval.hours * 60 * 60 * 1000),
    }
}

fn read_task_directions(path: &Path) -> Result<Vec<TaskDirection>, StoreError> {
    read_json_records(path)
}

fn normalize_schedule_frequency(value: String) -> String {
    let normalized = value.trim().to_ascii_lowercase();
    if let Some(interval) = custom_interval(&normalized) {
        return format!("custom:{}{}", interval.amount, interval.unit);
    }

    match normalized.as_str() {
        "daily" => "daily".to_string(),
        "weekly" => "weekly".to_string(),
        "custom" => "custom".to_string(),
        _ => "manual".to_string(),
    }
}

struct CustomInterval {
    amount: u128,
    unit: &'static str,
    hours: u128,
}

fn custom_interval(value: &str) -> Option<CustomInterval> {
    let raw = value.strip_prefix("custom:")?.trim();
    let (raw_amount, unit, multiplier) = if let Some(amount) = raw
        .strip_suffix("days")
        .or_else(|| raw.strip_suffix("day"))
        .or_else(|| raw.strip_suffix('d'))
    {
        (amount, "d", 24)
    } else {
        (
            raw.strip_suffix("hours")
                .or_else(|| raw.strip_suffix("hour"))
                .or_else(|| raw.strip_suffix('h'))
                .unwrap_or(raw),
            "h",
            1,
        )
    };
    let amount = raw_amount.trim().parse::<u128>().ok()?;
    let hours = amount.checked_mul(multiplier)?;

    (1..=720).contains(&hours).then_some(CustomInterval {
        amount,
        unit,
        hours,
    })
}

fn normalize_output_template(value: String) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "brief" => "brief".to_string(),
        "report" => "report".to_string(),
        "checklist" => "checklist".to_string(),
        "opportunity" => "opportunity".to_string(),
        _ => "auto".to_string(),
    }
}

fn normalize_push_channels(values: Vec<String>) -> Vec<String> {
    let mut channels = values
        .into_iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| matches!(value.as_str(), "email" | "feishu" | "wechat"))
        .collect::<Vec<_>>();

    channels.sort();
    channels.dedup();
    channels
}

fn default_schedule_frequency() -> String {
    "manual".to_string()
}

fn default_output_template() -> String {
    "auto".to_string()
}

fn schedule_preview_for_direction(direction: &TaskDirection, now: u128) -> TaskSchedulePreview {
    if !direction.active {
        return TaskSchedulePreview {
            direction_id: direction.id.clone(),
            direction_title: direction.title.clone(),
            frequency: direction.schedule_frequency.clone(),
            next_run_at_ms: None,
            next_run_label: "Inactive".to_string(),
            readiness: "inactive".to_string(),
            detail: "This direction is disabled and will not be scheduled.".to_string(),
            requires_network: direction.online_enabled,
            output_template: direction.output_template.clone(),
            push_enabled: direction.push_enabled,
            push_channels: direction.push_channels.clone(),
        };
    }

    let (next_run_at_ms, next_run_label, readiness, detail) = match direction
        .schedule_frequency
        .as_str()
    {
        "daily" => scheduled_preview(direction.updated_at_ms, now, 24 * 60 * 60 * 1000),
        "weekly" => scheduled_preview(direction.updated_at_ms, now, 7 * 24 * 60 * 60 * 1000),
        custom if custom_interval(custom).is_some() => scheduled_preview(
            direction.updated_at_ms,
            now,
            schedule_interval_ms(custom).unwrap_or(24 * 60 * 60 * 1000),
        ),
        "custom" => (
            None,
            "Needs interval".to_string(),
            "needs-schedule-rule".to_string(),
            "Custom frequency is selected, but interval rules are not configured yet.".to_string(),
        ),
        _ => (
            None,
            "Manual trigger".to_string(),
            "manual-only".to_string(),
            "Manual directions are mined only when the user starts Task Center mining.".to_string(),
        ),
    };

    TaskSchedulePreview {
        direction_id: direction.id.clone(),
        direction_title: direction.title.clone(),
        frequency: direction.schedule_frequency.clone(),
        next_run_at_ms,
        next_run_label,
        readiness,
        detail,
        requires_network: direction.online_enabled,
        output_template: direction.output_template.clone(),
        push_enabled: direction.push_enabled,
        push_channels: direction.push_channels.clone(),
    }
}

fn schedule_preview_for_direction_with_runs(
    direction: &TaskDirection,
    records: &[TaskRunRecord],
    now: u128,
) -> TaskSchedulePreview {
    let mut preview = schedule_preview_for_direction(direction, now);
    let Some(next_run_at_ms) = next_run_after_recent_completion(records, direction, now) else {
        return preview;
    };

    let remaining_hours = ((next_run_at_ms.saturating_sub(now)) / (60 * 60 * 1000)).max(1);
    preview.next_run_at_ms = Some(next_run_at_ms);
    preview.next_run_label = format!("After recent completion, in about {remaining_hours}h");
    preview.readiness = "recently-completed".to_string();
    preview.detail =
        "This direction already completed during the current interval; scheduler will wait."
            .to_string();
    preview
}

fn next_run_after_recent_completion(
    records: &[TaskRunRecord],
    direction: &TaskDirection,
    now: u128,
) -> Option<u128> {
    let interval_ms = schedule_interval_ms(&direction.schedule_frequency)?;
    records
        .iter()
        .filter(|record| is_completed_direction_run(record, &direction.id))
        .filter_map(|record| record.completed_at_ms)
        .max()
        .and_then(|completed_at_ms| {
            let next_run_at_ms = completed_at_ms.saturating_add(interval_ms);
            (next_run_at_ms > now).then_some(next_run_at_ms)
        })
}

fn is_completed_direction_run(record: &TaskRunRecord, direction_id: &str) -> bool {
    record.task_direction_id == direction_id
        && record.trigger_kind != "candidate-deepen"
        && record.source_candidate_id.is_none()
        && record.execution_state == "completed"
}

fn scheduled_preview(
    updated_at_ms: u128,
    now: u128,
    interval_ms: u128,
) -> (Option<u128>, String, String, String) {
    let next_run_at_ms = updated_at_ms.saturating_add(interval_ms);

    if next_run_at_ms <= now {
        (
            Some(now),
            "Ready now".to_string(),
            "ready-preview".to_string(),
            "This direction would be eligible now, but the background scheduler is not enabled yet."
                .to_string(),
        )
    } else {
        let remaining_hours = ((next_run_at_ms - now) / (60 * 60 * 1000)).max(1);
        (
            Some(next_run_at_ms),
            format!("In about {remaining_hours}h"),
            "scheduled-preview".to_string(),
            "This direction has a schedule preview only; no background job will run yet."
                .to_string(),
        )
    }
}

fn read_task_candidates(path: &Path) -> Result<Vec<TaskCandidate>, StoreError> {
    read_json_records(path)
}

fn read_task_run_records(path: &Path) -> Result<Vec<TaskRunRecord>, StoreError> {
    let mut records = read_json_records::<TaskRunRecord>(path)?;
    for record in &mut records {
        normalize_task_run_lifecycle(record);
        if record.idempotency_key.trim().is_empty() {
            record.idempotency_key = format!("legacy:{}", record.id);
        }
    }
    Ok(records)
}

fn task_run_idempotency_key(
    direction: &TaskDirection,
    trigger_kind: &str,
    now: u128,
    sequence: usize,
) -> String {
    if trigger_kind == "schedule-tick" {
        let interval = schedule_interval_ms(&direction.schedule_frequency).unwrap_or(1);
        return format!("schedule:{}:{}", direction.id, now / interval);
    }

    format!("manual:{}:{now}:{sequence}", direction.id)
}

fn transition_task_run(
    record: &mut TaskRunRecord,
    transition: TaskRunTransition,
) -> Result<(), StoreError> {
    normalize_task_run_lifecycle(record);
    let current = record.lifecycle_state.as_str();
    let next = match (current, transition) {
        ("awaiting-approval", TaskRunTransition::Approve) => "approved",
        ("awaiting-approval", TaskRunTransition::Reject) => "blocked",
        ("approved", TaskRunTransition::Start) => "running",
        ("approved", TaskRunTransition::Block) => "blocked",
        ("running", TaskRunTransition::Complete) => "succeeded",
        ("running", TaskRunTransition::Fail) => "failed",
        ("awaiting-approval" | "approved" | "failed", TaskRunTransition::Cancel) => "cancelled",
        ("blocked" | "succeeded" | "failed" | "cancelled", TaskRunTransition::Archive) => {
            "archived"
        }
        _ => {
            return Err(StoreError::InvalidInput(format!(
                "invalid task run transition: {current} -> {}",
                transition_label(transition)
            )))
        }
    };

    record.lifecycle_state = next.to_string();
    match next {
        "approved" => {
            record.approval_state = "approved".to_string();
            record.execution_state = "approved-not-started".to_string();
        }
        "blocked" => {
            if transition == TaskRunTransition::Reject {
                record.approval_state = "rejected".to_string();
            }
            record.execution_state = "blocked".to_string();
        }
        "succeeded" => {
            record.approval_state = "approved".to_string();
            record.execution_state = "completed".to_string();
        }
        "running" => {
            record.approval_state = "approved".to_string();
            record.execution_state = "running".to_string();
        }
        "failed" => {
            record.approval_state = "approved".to_string();
            record.execution_state = "failed".to_string();
        }
        "cancelled" => {
            record.execution_state = "cancelled".to_string();
        }
        "archived" => {}
        _ => {}
    }

    Ok(())
}

fn normalize_task_run_lifecycle(record: &mut TaskRunRecord) {
    if !matches!(
        record.lifecycle_state.as_str(),
        "awaiting-approval"
            | "approved"
            | "running"
            | "blocked"
            | "succeeded"
            | "failed"
            | "cancelled"
            | "archived"
    ) {
        record.lifecycle_state = inferred_lifecycle_state(record).to_string();
    }
}

fn effective_lifecycle_state(record: &TaskRunRecord) -> &str {
    if !matches!(
        record.lifecycle_state.as_str(),
        "awaiting-approval"
            | "approved"
            | "running"
            | "blocked"
            | "succeeded"
            | "failed"
            | "cancelled"
            | "archived"
    ) {
        inferred_lifecycle_state(record)
    } else {
        record.lifecycle_state.as_str()
    }
}

fn inferred_lifecycle_state(record: &TaskRunRecord) -> &'static str {
    if record.archived_at_ms.is_some() {
        "archived"
    } else if record.execution_state == "completed" {
        "succeeded"
    } else if record.execution_state == "cancelled" {
        "cancelled"
    } else if record.execution_state == "failed" {
        "failed"
    } else if record.execution_state == "running" {
        "running"
    } else if record.execution_state == "blocked" || record.approval_state == "rejected" {
        "blocked"
    } else if record.approval_state == "approved"
        || record.execution_state == "approved-not-started"
    {
        "approved"
    } else {
        "awaiting-approval"
    }
}

fn transition_label(transition: TaskRunTransition) -> &'static str {
    match transition {
        TaskRunTransition::Approve => "approve",
        TaskRunTransition::Reject => "reject",
        TaskRunTransition::Start => "start",
        TaskRunTransition::Block => "block",
        TaskRunTransition::Complete => "complete",
        TaskRunTransition::Fail => "fail",
        TaskRunTransition::Cancel => "cancel",
        TaskRunTransition::Archive => "archive",
    }
}

fn write_task_candidates(path: &Path, records: &[TaskCandidate]) -> Result<(), StoreError> {
    write_json_records(path, records)
}

fn remove_task_candidates_by_ids(path: &Path, candidate_ids: &[String]) -> Result<(), StoreError> {
    let mut records = read_task_candidates(path)?;
    records.retain(|candidate| !candidate_ids.contains(&candidate.id));
    write_task_candidates(path, &records)
}

fn candidates_for_direction(
    direction: &TaskDirection,
    memories: &[MemoryItem],
) -> Vec<TaskCandidate> {
    if direction.keywords.is_empty() {
        return Vec::new();
    }

    let mut generated = Vec::new();
    for memory in memories {
        let matched_keywords = matched_keywords(direction, memory);
        if matched_keywords.is_empty() {
            continue;
        }

        let keyword_score = (matched_keywords.len() as f64 * 0.2).min(0.6);
        let priority_score = (direction.priority as f64 * 0.1).min(0.5);
        let confidence_score = (memory.confidence * 0.2).min(0.2);
        let score = (keyword_score + priority_score + confidence_score).min(1.0);
        let summary = format!("{} -> {}", direction.title, short_text(&memory.content, 96));
        let resolved_output_template = resolved_output_template(direction, memory);
        let explanation = format!(
            "Matched {} keyword{} from {} {} item; priority {} contributed to ranking; passed {:.0}% minimum score.",
            matched_keywords.len(),
            if matched_keywords.len() == 1 { "" } else { "s" },
            memory.scope,
            memory.hub_area,
            direction.priority,
            MIN_CANDIDATE_SCORE * 100.0
        );

        if score < MIN_CANDIDATE_SCORE {
            continue;
        }

        generated.push(TaskCandidate {
            id: String::new(),
            created_at_ms: 0,
            task_direction_id: direction.id.clone(),
            task_direction_title: direction.title.clone(),
            memory_item_id: memory.id.clone(),
            summary,
            score,
            score_components: TaskCandidateScoreComponents {
                keyword_score,
                priority_score,
                memory_confidence: memory.confidence,
                final_score: score,
            },
            matched_keywords,
            evidence: vec![
                evidence("Zhishu area", &memory.hub_area),
                evidence("Memory scope", &memory.scope),
                evidence("Memory level", &memory.level),
                evidence("Memory type", &memory.item_type),
                evidence("Admission", &memory.admission_state),
                evidence("Source trust", &memory.source_trust),
                evidence("Output template", &direction.output_template),
                evidence("Resolved output template", &resolved_output_template),
                evidence(
                    "Minimum score",
                    &format!("{:.0}%", MIN_CANDIDATE_SCORE * 100.0),
                ),
            ],
            explanation,
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        });
    }

    generated
}

fn resolved_output_template(direction: &TaskDirection, memory: &MemoryItem) -> String {
    if direction.output_template != "auto" {
        return direction.output_template.clone();
    }

    let content = format!(
        "{} {} {} {} {}",
        direction.title,
        direction.description,
        memory.content,
        memory.item_type,
        memory.tags.join(" ")
    )
    .to_ascii_lowercase();

    if contains_any_text(
        &content,
        &[
            "checklist",
            "todo",
            "step",
            "steps",
            "skill",
            "flow",
            "script",
            "interface",
            "repair",
            "troubleshoot",
            "清单",
            "步骤",
            "流程",
            "接口",
            "排查",
            "故障",
        ],
    ) {
        return "checklist".to_string();
    }

    if contains_any_text(
        &content,
        &[
            "opportunity",
            "monetize",
            "product",
            "paid",
            "template",
            "market",
            "机会",
            "变现",
            "产品",
            "模板",
        ],
    ) {
        return "opportunity".to_string();
    }

    if contains_any_text(
        &content,
        &[
            "report",
            "analysis",
            "standard",
            "regulation",
            "forensic",
            "报告",
            "分析",
            "标准",
            "法规",
            "司法鉴定",
        ],
    ) {
        return "report".to_string();
    }

    "brief".to_string()
}

fn contains_any_text(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn candidates_for_source_candidate(
    candidate_path: &Path,
    source_candidate_id: &str,
) -> Result<Vec<TaskCandidate>, StoreError> {
    let candidates = read_task_candidates(candidate_path)?;
    let Some(source) = candidates
        .iter()
        .find(|candidate| candidate.id == source_candidate_id)
    else {
        return Err(StoreError::NotFound(source_candidate_id.to_string()));
    };

    let score = (source.score + 0.08).min(1.0);
    let mut evidence_items = source.evidence.clone();
    evidence_items.insert(0, evidence("Source candidate", &source.id));
    evidence_items.insert(1, evidence("Source status", &source.status));
    evidence_items.insert(
        2,
        evidence("Source score", &format!("{:.0}%", source.score * 100.0)),
    );

    Ok(vec![TaskCandidate {
        id: String::new(),
        created_at_ms: 0,
        task_direction_id: source.task_direction_id.clone(),
        task_direction_title: source.task_direction_title.clone(),
        memory_item_id: format!("candidate:{}", source.id),
        summary: format!(
            "Deepen {} -> {}",
            source.task_direction_title,
            short_text(&source.summary, 120)
        ),
        score,
        score_components: TaskCandidateScoreComponents {
            keyword_score: source.score_components.keyword_score,
            priority_score: source.score_components.priority_score,
            memory_confidence: source.score_components.memory_confidence,
            final_score: score,
        },
        matched_keywords: source.matched_keywords.clone(),
        evidence: evidence_items,
        explanation: format!(
            "Deepened from reviewed Task Center candidate {}; approval is still required before any execution.",
            source.id
        ),
        status: "candidate".to_string(),
        reviewed_at_ms: None,
        review_decision: None,
        promoted_memory_id: None,
        source_candidate_id: Some(source.id.clone()),
    }])
}

fn evidence(label: &str, value: &str) -> TaskCandidateEvidence {
    TaskCandidateEvidence {
        label: label.to_string(),
        value: value.to_string(),
    }
}

fn persist_generated_candidates(
    candidate_path: &Path,
    mut generated: Vec<TaskCandidate>,
    limit: usize,
) -> Result<Vec<TaskCandidate>, StoreError> {
    generated.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.task_direction_title.cmp(&left.task_direction_title))
    });
    generated.truncate(limit);

    let mut existing = read_task_candidates(candidate_path)?;
    let now = now_millis();
    let base_count = existing.len();
    for (index, candidate) in generated.iter_mut().enumerate() {
        candidate.created_at_ms = now;
        candidate.id = format!("task-candidate-{now}-{}", base_count + index + 1);
    }

    existing.splice(0..0, generated.clone());
    dedupe_candidates(&mut existing);
    existing.truncate(100);
    write_task_candidates(candidate_path, &existing)?;

    Ok(generated)
}

fn matched_keywords(direction: &TaskDirection, memory: &MemoryItem) -> Vec<String> {
    let content = memory.content.to_ascii_lowercase();
    let tags = memory
        .tags
        .iter()
        .map(|tag| tag.to_ascii_lowercase())
        .collect::<Vec<_>>();

    direction
        .keywords
        .iter()
        .filter(|keyword| {
            let keyword = keyword.as_str();
            content.contains(keyword) || tags.iter().any(|tag| tag == keyword)
        })
        .cloned()
        .collect()
}

fn dedupe_candidates(records: &mut Vec<TaskCandidate>) {
    let mut seen = Vec::new();
    records.retain(|record| {
        let key = format!("{}:{}", record.task_direction_id, record.memory_item_id);
        if seen.iter().any(|item| item == &key) {
            false
        } else {
            seen.push(key);
            true
        }
    });
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;
    use crate::store::memory::{
        append_memory_item_at, recent_memory_items_at, review_memory_item_at,
    };

    fn temp_history_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-{name}-{}.json", now_millis()))
    }

    #[test]
    fn appends_task_direction_with_normalized_keywords() {
        let path = temp_history_path("directions");

        let direction = append_task_direction_at(
            &path,
            "Template products".to_string(),
            "Find reusable template opportunities.".to_string(),
            9,
            vec![
                " Templates ".to_string(),
                "products".to_string(),
                "templates".to_string(),
            ],
            "daily".to_string(),
            true,
            "report".to_string(),
        )
        .unwrap();

        assert_eq!(direction.priority, 5);
        assert!(direction.active);
        assert_eq!(
            direction.keywords,
            vec!["products".to_string(), "templates".to_string()]
        );
        assert_eq!(direction.schedule_frequency, "daily");
        assert!(direction.online_enabled);
        assert_eq!(direction.output_template, "report");
        assert!(!direction.push_enabled);
        assert!(direction.push_channels.is_empty());

        let _ = fs::remove_file(path);
    }

    #[test]
    fn restores_task_direction_state_to_isolated_history() {
        let path = temp_history_path("restore-direction");
        let direction = append_task_direction_at(
            &path,
            "Original direction".to_string(),
            "Original description".to_string(),
            3,
            vec!["original".to_string()],
            "manual".to_string(),
            false,
            "brief".to_string(),
        )
        .unwrap();
        let restored = TaskDirection {
            updated_at_ms: 1,
            title: "Restored direction".to_string(),
            description: "Restored description".to_string(),
            active: false,
            keywords: vec!["restored".to_string()],
            ..direction
        };

        let receipt = restore_task_direction_at(&path, restored).unwrap();
        let persisted = task_directions_at(&path, 5).unwrap();

        assert_eq!(receipt.title, "Restored direction");
        assert!(!receipt.active);
        assert!(receipt.updated_at_ms > 1);
        assert_eq!(persisted.len(), 1);
        assert_eq!(persisted[0].id, receipt.id);
        assert_eq!(persisted[0].title, "Restored direction");
        assert!(!persisted[0].active);
        assert_eq!(persisted[0].keywords, vec!["restored".to_string()]);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn appends_task_direction_with_normalized_push_channels() {
        let path = temp_history_path("directions-with-push");

        let direction = append_task_direction_with_push_at(
            &path,
            "Push reports".to_string(),
            "Deliver scheduled summaries.".to_string(),
            3,
            Vec::new(),
            "weekly".to_string(),
            false,
            true,
            vec![
                " Feishu ".to_string(),
                "email".to_string(),
                "unknown".to_string(),
                "feishu".to_string(),
            ],
            "brief".to_string(),
        )
        .unwrap();

        assert!(direction.push_enabled);
        assert_eq!(
            direction.push_channels,
            vec!["email".to_string(), "feishu".to_string()]
        );

        let _ = fs::remove_file(path);
    }

    #[test]
    fn returns_task_directions_by_priority() {
        let path = temp_history_path("direction-order");

        append_task_direction_at(
            &path,
            "Low".to_string(),
            "low priority".to_string(),
            1,
            Vec::new(),
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_task_direction_at(
            &path,
            "High".to_string(),
            "high priority".to_string(),
            5,
            Vec::new(),
            "weekly".to_string(),
            false,
            "brief".to_string(),
        )
        .unwrap();

        let records = task_directions_at(&path, 5).unwrap();

        assert_eq!(records[0].title, "High");
        assert_eq!(records[1].title, "Low");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn generates_task_candidates_from_direction_keyword_matches() {
        let candidate_path = temp_history_path("candidates");
        let direction_path = temp_history_path("candidate-directions");
        let memory_path = temp_history_path("candidate-memory");

        append_task_direction_at(
            &direction_path,
            "Template products".to_string(),
            "Find reusable paid templates.".to_string(),
            5,
            vec!["template".to_string(), "paid".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "Turn messy project notes into a paid template".to_string(),
            vec!["template".to_string()],
            0.5,
            "unverified",
        )
        .unwrap();

        let candidates =
            generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].task_direction_title, "Template products");
        assert_eq!(
            candidates[0].matched_keywords,
            vec!["paid".to_string(), "template".to_string()]
        );
        assert!(candidates[0].score > 0.0);
        assert!(candidates[0].score_components.keyword_score > 0.0);
        assert!(candidates[0].score_components.priority_score > 0.0);
        assert_eq!(
            candidates[0].score_components.final_score,
            candidates[0].score
        );
        assert!(candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Zhishu area" && item.value == "memory"));
        assert!(candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Memory scope"));
        assert!(candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Output template" && item.value == "auto"));
        assert!(candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Resolved output template" && item.value == "opportunity"));
        assert!(candidates[0]
            .explanation
            .contains("from L0 Session memory item"));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn generates_task_candidates_from_chinese_direction_keywords() {
        let candidate_path = temp_history_path("chinese-candidates");
        let direction_path = temp_history_path("chinese-candidate-directions");
        let memory_path = temp_history_path("chinese-candidate-memory");

        append_task_direction_at(
            &direction_path,
            "司法鉴定模板".to_string(),
            "挖掘可复用文书模板机会。".to_string(),
            5,
            vec!["司法".to_string(), "模板".to_string()],
            "manual".to_string(),
            false,
            "report".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "把司法鉴定文书模板整理成可复用工具".to_string(),
            Vec::new(),
            0.5,
            "unverified",
        )
        .unwrap();

        let candidates =
            generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates[0].matched_keywords,
            vec!["司法".to_string(), "模板".to_string()]
        );
        assert!(candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Output template" && item.value == "report"));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn resolves_script_interface_candidates_to_checklist_template() {
        let candidate_path = temp_history_path("script-template-candidates");
        let direction_path = temp_history_path("script-template-directions");
        let memory_path = temp_history_path("script-template-memory");

        append_task_direction_at(
            &direction_path,
            "Script interface review".to_string(),
            "Turn reusable tool rules into usable steps.".to_string(),
            3,
            vec!["script".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L2 Knowledge",
            "candidate",
            "script-interface",
            "manual-zhishu",
            "Script interface for cleanup helper".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();

        let candidates =
            generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        assert_eq!(candidates.len(), 1);
        assert!(candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Resolved output template" && item.value == "checklist"));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn generating_candidates_without_directions_is_empty() {
        let candidate_path = temp_history_path("empty-candidates");
        let direction_path = temp_history_path("empty-candidate-directions");
        let memory_path = temp_history_path("empty-candidate-memory");

        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "A monetizable workflow idea".to_string(),
            vec!["workflow".to_string()],
            0.5,
            "unverified",
        )
        .unwrap();

        let candidates =
            generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        assert!(candidates.is_empty());

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn rejected_memory_items_do_not_generate_task_candidates() {
        let candidate_path = temp_history_path("rejected-memory-candidates");
        let direction_path = temp_history_path("rejected-memory-directions");
        let memory_path = temp_history_path("rejected-memory");

        append_task_direction_at(
            &direction_path,
            "Template scan".to_string(),
            "Find template work.".to_string(),
            3,
            vec!["template".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let item = append_memory_item_at(
            &memory_path,
            "L2 Knowledge",
            "candidate",
            "knowledge",
            "manual-zhishu",
            "template knowledge candidate".to_string(),
            Vec::new(),
            0.6,
            "unverified",
        )
        .unwrap();
        review_memory_item_at(&memory_path, item.id, "rejected".to_string()).unwrap();

        let candidates =
            generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        assert!(candidates.is_empty());

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn resolves_auto_output_template_to_report_for_chinese_forensic_knowledge() {
        let direction = TaskDirection {
            id: "direction-report".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "司法鉴定法规报告".to_string(),
            description: "整理行业标准和法规分析。".to_string(),
            priority: 3,
            active: true,
            keywords: vec!["司法鉴定".to_string()],
            schedule_frequency: "manual".to_string(),
            online_enabled: false,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
        };
        let memory = MemoryItem {
            id: "memory-report".to_string(),
            created_at_ms: 1,
            hub_area: "knowledge".to_string(),
            scope: "L2 Knowledge".to_string(),
            level: "L2".to_string(),
            item_type: "knowledge".to_string(),
            admission_state: "reviewed-local".to_string(),
            admission_rule: "manual-test".to_string(),
            source: "test".to_string(),
            provenance: "test".to_string(),
            source_trust: "trusted".to_string(),
            content: "司法鉴定行业标准与法规条款分析".to_string(),
            tags: vec!["司法鉴定".to_string()],
            confidence: 0.8,
            verification: "reviewed".to_string(),
            retention_policy: "durable".to_string(),
            authority: "local".to_string(),
            linked_memory_ids: Vec::new(),
            last_reinforced_at_ms: None,
            last_invalidated_at_ms: None,
        };

        assert_eq!(resolved_output_template(&direction, &memory), "report");
    }

    #[test]
    fn weak_candidate_below_quality_threshold_is_filtered() {
        let candidate_path = temp_history_path("weak-candidates");
        let direction_path = temp_history_path("weak-directions");
        let memory_path = temp_history_path("weak-memory");

        append_task_direction_at(
            &direction_path,
            "Weak match".to_string(),
            "Low priority direction.".to_string(),
            1,
            vec!["maybe".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "maybe useful someday".to_string(),
            Vec::new(),
            0.1,
            "unverified",
        )
        .unwrap();

        let candidates =
            generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        assert!(candidates.is_empty());

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn repeated_candidate_generation_dedupes_direction_memory_pairs() {
        let candidate_path = temp_history_path("dedupe-candidates");
        let direction_path = temp_history_path("dedupe-directions");
        let memory_path = temp_history_path("dedupe-memory");

        append_task_direction_at(
            &direction_path,
            "Workflow automation".to_string(),
            "Find automation opportunities.".to_string(),
            4,
            vec!["automation".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "automation idea for recurring reports".to_string(),
            Vec::new(),
            0.5,
            "unverified",
        )
        .unwrap();

        generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();
        generate_task_candidates_at(&candidate_path, &direction_path, &memory_path).unwrap();

        let records = task_candidates_at(&candidate_path, 10).unwrap();

        assert_eq!(records.len(), 1);

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn reads_legacy_task_direction_with_schedule_defaults() {
        let path = temp_history_path("legacy-direction");
        fs::write(
            &path,
            r#"[
              {
                "id": "direction-legacy-1",
                "created_at_ms": 1,
                "updated_at_ms": 1,
                "title": "Legacy direction",
                "description": "old shape",
                "priority": 3,
                "active": true,
                "keywords": ["legacy"]
              }
            ]"#,
        )
        .unwrap();

        let records = task_directions_at(&path, 5).unwrap();

        assert_eq!(records[0].schedule_frequency, "manual");
        assert!(!records[0].online_enabled);
        assert_eq!(records[0].output_template, "auto");
        assert!(!records[0].push_enabled);
        assert!(records[0].push_channels.is_empty());

        let _ = fs::remove_file(path);
    }

    #[test]
    fn previews_daily_task_direction_schedule_without_running_job() {
        let path = temp_history_path("daily-schedule");

        append_task_direction_with_push_at(
            &path,
            "Daily scan".to_string(),
            "Find recurring opportunities.".to_string(),
            4,
            vec!["recurring".to_string()],
            "daily".to_string(),
            true,
            true,
            vec!["wechat".to_string()],
            "brief".to_string(),
        )
        .unwrap();

        let previews = task_schedule_previews_at(&path, 5).unwrap();

        assert_eq!(previews.len(), 1);
        assert_eq!(previews[0].frequency, "daily");
        assert_eq!(previews[0].readiness, "scheduled-preview");
        assert!(previews[0].next_run_at_ms.is_some());
        assert!(previews[0].requires_network);
        assert_eq!(previews[0].output_template, "brief");
        assert!(previews[0].push_enabled);
        assert_eq!(previews[0].push_channels, vec!["wechat".to_string()]);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn previews_custom_hourly_task_direction_schedule() {
        let path = temp_history_path("custom-schedule");

        append_task_direction_at(
            &path,
            "Hourly scan".to_string(),
            "Find timely work.".to_string(),
            3,
            Vec::new(),
            "custom:6h".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();

        let previews = task_schedule_previews_at(&path, 5).unwrap();

        assert_eq!(previews[0].frequency, "custom:6h");
        assert_ne!(previews[0].readiness, "needs-schedule-rule");
        assert!(previews[0].next_run_at_ms.is_some());

        let _ = fs::remove_file(path);
    }

    #[test]
    fn previews_custom_daily_interval_task_direction_schedule() {
        let path = temp_history_path("custom-day-schedule");

        append_task_direction_at(
            &path,
            "Two day scan".to_string(),
            "Find slower recurring work.".to_string(),
            3,
            Vec::new(),
            "custom:2d".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();

        let previews = task_schedule_previews_at(&path, 5).unwrap();

        assert_eq!(previews[0].frequency, "custom:2d");
        assert_ne!(previews[0].readiness, "needs-schedule-rule");
        assert!(previews[0].next_run_at_ms.is_some());

        let _ = fs::remove_file(path);
    }

    #[test]
    fn previews_manual_task_direction_as_manual_only() {
        let path = temp_history_path("manual-schedule");

        append_task_direction_at(
            &path,
            "Manual scan".to_string(),
            "Find manual opportunities.".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();

        let previews = task_schedule_previews_at(&path, 5).unwrap();

        assert_eq!(previews[0].readiness, "manual-only");
        assert_eq!(previews[0].next_run_label, "Manual trigger");
        assert!(previews[0].next_run_at_ms.is_none());

        let _ = fs::remove_file(path);
    }

    #[test]
    fn records_task_run_request_without_starting_execution() {
        let run_path = temp_history_path("task-runs");
        let direction_path = temp_history_path("run-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Daily scan".to_string(),
            "Find useful work.".to_string(),
            4,
            vec!["work".to_string()],
            "daily".to_string(),
            true,
            "brief".to_string(),
        )
        .unwrap();

        let record = request_task_run_at(&run_path, &direction_path, direction.id.clone()).unwrap();
        let records = task_run_records_at(&run_path, 5).unwrap();

        assert_eq!(record.task_direction_id, direction.id);
        assert_eq!(record.approval_state, "waiting-approval");
        assert_eq!(record.execution_state, "not-started");
        assert_eq!(records.len(), 1);
        assert!(records[0].online_enabled);

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn task_run_request_snapshots_direction_push_preferences() {
        let run_path = temp_history_path("task-runs-push");
        let direction_path = temp_history_path("run-directions-push");
        let direction = append_task_direction_with_push_at(
            &direction_path,
            "Push scan".to_string(),
            "Deliver useful work summaries.".to_string(),
            4,
            vec!["work".to_string()],
            "daily".to_string(),
            false,
            true,
            vec!["feishu".to_string()],
            "brief".to_string(),
        )
        .unwrap();

        let record = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();

        assert!(record.push_enabled);
        assert_eq!(record.push_channels, vec!["feishu".to_string()]);

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn repeated_task_run_request_reuses_open_direction_run() {
        let run_path = temp_history_path("task-runs-reuse");
        let direction_path = temp_history_path("run-directions-reuse");
        let direction = append_task_direction_at(
            &direction_path,
            "Daily scan".to_string(),
            "Find useful work.".to_string(),
            4,
            vec!["work".to_string()],
            "daily".to_string(),
            true,
            "brief".to_string(),
        )
        .unwrap();

        let first = request_task_run_at(&run_path, &direction_path, direction.id.clone()).unwrap();
        let second = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        let records = task_run_records_at(&run_path, 5).unwrap();

        assert_eq!(first.id, second.id);
        assert_eq!(records.len(), 1);

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn rejects_task_run_request_for_inactive_direction() {
        let run_path = temp_history_path("inactive-task-runs");
        let direction_path = temp_history_path("inactive-run-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Paused scan".to_string(),
            "Should not create runs while inactive.".to_string(),
            4,
            vec!["work".to_string()],
            "daily".to_string(),
            true,
            "brief".to_string(),
        )
        .unwrap();
        set_task_direction_active_at(&direction_path, direction.id.clone(), false).unwrap();

        let result = request_task_run_at(&run_path, &direction_path, direction.id);
        let records = task_run_records_at(&run_path, 5).unwrap();

        assert!(
            matches!(result, Err(StoreError::InvalidInput(message)) if message.contains("inactive"))
        );
        assert!(records.is_empty());

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn updates_task_direction_active_state() {
        let path = temp_history_path("direction-active");
        let direction = append_task_direction_at(
            &path,
            "Toggle me".to_string(),
            "Can be disabled.".to_string(),
            3,
            vec!["toggle".to_string()],
            "daily".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();

        let updated = set_task_direction_active_at(&path, direction.id, false).unwrap();
        let previews = task_schedule_previews_at(&path, 5).unwrap();

        assert!(!updated.active);
        assert_eq!(previews[0].readiness, "inactive");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn completed_and_deepen_runs_are_not_open_direction_runs() {
        let completed = TaskRunRecord {
            id: "completed-run".to_string(),
            created_at_ms: 10,
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Direction".to_string(),
            trigger_kind: "manual-request".to_string(),
            idempotency_key: "test:completed-run".to_string(),
            schedule_frequency: "manual".to_string(),
            online_enabled: false,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "succeeded".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "completed".to_string(),
            detail: "done".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: Some(15),
            completed_at_ms: Some(20),
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: None,
            source_candidate_id: None,
        };
        let deepen = TaskRunRecord {
            trigger_kind: "candidate-deepen".to_string(),
            lifecycle_state: "approved".to_string(),
            execution_state: "not-started".to_string(),
            source_candidate_id: Some("candidate-1".to_string()),
            ..completed.clone()
        };
        let open = TaskRunRecord {
            id: "open-run".to_string(),
            lifecycle_state: "approved".to_string(),
            execution_state: "approved-not-started".to_string(),
            completed_at_ms: None,
            ..completed.clone()
        };

        assert!(!is_open_direction_run(&completed, "direction-1"));
        assert!(!is_open_direction_run(&deepen, "direction-1"));
        assert!(is_open_direction_run(&open, "direction-1"));
    }

    #[test]
    fn reviews_task_run_without_starting_execution() {
        let run_path = temp_history_path("review-task-runs");
        let direction_path = temp_history_path("review-run-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Weekly scan".to_string(),
            "Find useful work.".to_string(),
            4,
            Vec::new(),
            "weekly".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let record = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();

        let reviewed = review_task_run_at(&run_path, record.id, true).unwrap();

        assert_eq!(reviewed.approval_state, "approved");
        assert_eq!(reviewed.execution_state, "approved-not-started");
        assert_eq!(reviewed.lifecycle_state, "approved");
        assert!(reviewed.detail.contains("no execution was started"));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn rejects_review_after_task_run_leaves_approval_queue() {
        let run_path = temp_history_path("invalid-second-review-runs");
        let direction_path = temp_history_path("invalid-second-review-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Review once".to_string(),
            "A run cannot be reviewed twice.".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let record = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        review_task_run_at(&run_path, record.id.clone(), false).unwrap();

        let error = review_task_run_at(&run_path, record.id, true).unwrap_err();

        assert!(error
            .to_string()
            .contains("invalid task run transition: blocked -> approve"));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn cancels_and_archives_task_run_through_guarded_transitions() {
        let run_path = temp_history_path("cancel-archive-runs");
        let direction_path = temp_history_path("cancel-archive-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Cancelable run".to_string(),
            "Exercise cancellation and archival.".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let record = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();

        let cancelled =
            transition_task_run_at(&run_path, record.id.clone(), TaskRunTransition::Cancel)
                .unwrap();
        assert_eq!(cancelled.lifecycle_state, "cancelled");
        assert_eq!(cancelled.execution_state, "cancelled");
        assert!(cancelled.cancelled_at_ms.is_some());

        let archived =
            transition_task_run_at(&run_path, record.id, TaskRunTransition::Archive).unwrap();
        assert_eq!(archived.lifecycle_state, "archived");
        assert!(archived.archived_at_ms.is_some());

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn rejects_archive_before_task_run_reaches_terminal_state() {
        let run_path = temp_history_path("invalid-archive-runs");
        let direction_path = temp_history_path("invalid-archive-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Active run".to_string(),
            "Cannot archive before terminal state.".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let record = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();

        let error =
            transition_task_run_at(&run_path, record.id, TaskRunTransition::Archive).unwrap_err();

        assert!(error
            .to_string()
            .contains("invalid task run transition: awaiting-approval -> archive"));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn recovers_interrupted_running_task_as_failed() {
        let run_path = temp_history_path("recover-running-runs");
        let direction_path = temp_history_path("recover-running-directions");
        let direction = append_task_direction_at(
            &direction_path,
            "Interrupted run".to_string(),
            "Recover after process exit.".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let record = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        transition_task_run_at(&run_path, record.id.clone(), TaskRunTransition::Approve).unwrap();
        transition_task_run_at(&run_path, record.id.clone(), TaskRunTransition::Start).unwrap();

        let recovered = recover_interrupted_task_runs_at(&run_path, 5_000).unwrap();
        let stored = task_run_records_at(&run_path, 5)
            .unwrap()
            .into_iter()
            .find(|run| run.id == record.id)
            .unwrap();

        assert_eq!(recovered.len(), 1);
        assert_eq!(stored.lifecycle_state, "failed");
        assert_eq!(stored.failed_at_ms, Some(5_000));
        assert!(stored
            .error_summary
            .as_deref()
            .unwrap()
            .contains("Previous process ended"));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn infers_lifecycle_for_legacy_task_run_records() {
        let run_path = temp_history_path("legacy-run-lifecycle");
        fs::write(
            &run_path,
            r#"[
              {
                "id": "legacy-run",
                "created_at_ms": 1,
                "task_direction_id": "direction-1",
                "task_direction_title": "Legacy",
                "trigger_kind": "manual-request",
                "schedule_frequency": "manual",
                "online_enabled": false,
                "output_template": "auto",
                "approval_state": "approved",
                "execution_state": "completed",
                "detail": "done",
                "generated_candidate_ids": [],
                "completed_at_ms": 2
              }
            ]"#,
        )
        .unwrap();

        let records = read_task_run_records(&run_path).unwrap();

        assert_eq!(records[0].lifecycle_state, "succeeded");
        assert_eq!(records[0].idempotency_key, "legacy:legacy-run");

        let _ = fs::remove_file(run_path);
    }

    #[test]
    fn scheduler_idempotency_key_blocks_duplicate_after_cancel() {
        let run_path = temp_history_path("scheduler-idempotent-runs");
        let direction_path = temp_history_path("scheduler-idempotent-directions");
        let direction = TaskDirection {
            id: "direction-idempotent".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Idempotent schedule".to_string(),
            description: "Only one run per interval.".to_string(),
            priority: 3,
            active: true,
            keywords: Vec::new(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        };
        write_json_records(&direction_path, &[direction]).unwrap();
        let first_tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();
        transition_task_run_at(
            &run_path,
            first_tick.created_runs[0].id.clone(),
            TaskRunTransition::Cancel,
        )
        .unwrap();

        let second_tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();

        assert_eq!(first_tick.created_run_count, 1);
        assert_eq!(second_tick.created_run_count, 0);
        assert_eq!(task_run_records_at(&run_path, 10).unwrap().len(), 1);

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn reviews_candidate_deepen_run_with_specific_detail() {
        let candidate_path = temp_history_path("review-deepen-candidate");
        let run_path = temp_history_path("review-deepen-runs");
        let memory_path = temp_history_path("review-deepen-memory");
        let candidate = TaskCandidate {
            id: "candidate-1".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Workflow".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Workflow -> deeper productization path".to_string(),
            score: 0.7,
            score_components: Default::default(),
            matched_keywords: vec!["workflow".to_string()],
            evidence: Vec::new(),
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();
        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "deepen".to_string(),
        )
        .unwrap();

        let reviewed =
            review_task_run_at(&run_path, review.follow_up_run.unwrap().id, true).unwrap();

        assert_eq!(reviewed.approval_state, "approved");
        assert!(reviewed.detail.contains("Candidate deepening approved"));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn schedule_preview_reports_recent_completion_interval() {
        let run_path = temp_history_path("preview-completed-run");
        let direction_path = temp_history_path("preview-completed-direction");
        let now = now_millis();
        let direction = TaskDirection {
            id: "direction-preview-completed".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Preview completed".to_string(),
            description: "recently done".to_string(),
            priority: 3,
            active: true,
            keywords: Vec::new(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        };
        let completed = TaskRunRecord {
            id: "completed-preview-run".to_string(),
            created_at_ms: now,
            task_direction_id: "direction-preview-completed".to_string(),
            task_direction_title: "Preview completed".to_string(),
            trigger_kind: "schedule-tick".to_string(),
            idempotency_key: "test:completed-preview-run".to_string(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "succeeded".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "completed".to_string(),
            detail: "done".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: Some(now),
            completed_at_ms: Some(now),
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: None,
            source_candidate_id: None,
        };
        write_json_records(&direction_path, &[direction]).unwrap();
        write_json_records(&run_path, &[completed]).unwrap();

        let previews = task_schedule_previews_with_runs_at(&direction_path, &run_path, 5).unwrap();

        assert_eq!(previews[0].readiness, "recently-completed");
        assert!(previews[0].next_run_at_ms.is_some());

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn scheduler_tick_records_due_runs_without_execution() {
        let run_path = temp_history_path("scheduler-runs");
        let direction_path = temp_history_path("scheduler-directions");
        let direction = TaskDirection {
            id: "direction-due".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Due scan".to_string(),
            description: "ready".to_string(),
            priority: 3,
            active: true,
            keywords: Vec::new(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        };
        write_json_records(&direction_path, &[direction]).unwrap();

        let tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();
        let records = task_run_records_at(&run_path, 5).unwrap();

        assert_eq!(tick.created_run_count, 1);
        assert_eq!(records[0].trigger_kind, "schedule-tick");
        assert_eq!(records[0].approval_state, "waiting-approval");
        assert_eq!(records[0].execution_state, "not-started");

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn scheduler_tick_ignores_completed_deepen_runs_for_direction_interval() {
        let run_path = temp_history_path("scheduler-deepen-completed-runs");
        let direction_path = temp_history_path("scheduler-deepen-completed-directions");
        let now = now_millis();
        let direction = TaskDirection {
            id: "direction-deepen-completed".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Due after deepen".to_string(),
            description: "ready".to_string(),
            priority: 3,
            active: true,
            keywords: Vec::new(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        };
        let completed_deepen = TaskRunRecord {
            id: "completed-deepen-run".to_string(),
            created_at_ms: now,
            task_direction_id: "direction-deepen-completed".to_string(),
            task_direction_title: "Due after deepen".to_string(),
            trigger_kind: "candidate-deepen".to_string(),
            idempotency_key: "candidate-deepen:candidate-1".to_string(),
            schedule_frequency: "manual".to_string(),
            online_enabled: false,
            output_template: "brief".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "succeeded".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "completed".to_string(),
            detail: "deepened".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: Some(now),
            completed_at_ms: Some(now),
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: None,
            source_candidate_id: Some("candidate-1".to_string()),
        };
        write_json_records(&direction_path, &[direction]).unwrap();
        write_json_records(&run_path, &[completed_deepen]).unwrap();

        let tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();
        let records = task_run_records_at(&run_path, 5).unwrap();

        assert_eq!(tick.created_run_count, 1);
        assert_eq!(records[0].trigger_kind, "schedule-tick");

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn scheduler_tick_skips_recently_completed_direction_interval() {
        let run_path = temp_history_path("scheduler-completed-runs");
        let direction_path = temp_history_path("scheduler-completed-directions");
        let now = now_millis();
        let direction = TaskDirection {
            id: "direction-due".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Due scan".to_string(),
            description: "ready".to_string(),
            priority: 3,
            active: true,
            keywords: Vec::new(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        };
        let completed = TaskRunRecord {
            id: "completed-run".to_string(),
            created_at_ms: now,
            task_direction_id: "direction-due".to_string(),
            task_direction_title: "Due scan".to_string(),
            trigger_kind: "schedule-tick".to_string(),
            idempotency_key: "test:completed-run".to_string(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "succeeded".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "completed".to_string(),
            detail: "done".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: Some(now),
            completed_at_ms: Some(now),
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: None,
            source_candidate_id: None,
        };
        write_json_records(&direction_path, &[direction]).unwrap();
        write_json_records(&run_path, &[completed]).unwrap();

        let tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();

        assert_eq!(tick.created_run_count, 0);
        assert_eq!(tick.skipped_run_count, 1);

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn scheduler_tick_allows_new_run_after_completed_interval_expires() {
        let run_path = temp_history_path("scheduled-expired-run");
        let direction_path = temp_history_path("scheduled-expired-direction");
        let now = now_millis();
        let direction = TaskDirection {
            id: "direction-expired".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Expired scan".to_string(),
            description: "ready again".to_string(),
            priority: 3,
            active: true,
            keywords: Vec::new(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        };
        let completed = TaskRunRecord {
            id: "old-completed-run".to_string(),
            created_at_ms: now.saturating_sub(3 * 24 * 60 * 60 * 1000),
            task_direction_id: "direction-expired".to_string(),
            task_direction_title: "Expired scan".to_string(),
            trigger_kind: "schedule-tick".to_string(),
            idempotency_key: "test:old-completed-run".to_string(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "succeeded".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "completed".to_string(),
            detail: "done".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: Some(now.saturating_sub(3 * 24 * 60 * 60 * 1000)),
            completed_at_ms: Some(now.saturating_sub(3 * 24 * 60 * 60 * 1000)),
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: None,
            source_candidate_id: None,
        };
        write_json_records(&direction_path, &[direction]).unwrap();
        write_json_records(&run_path, &[completed]).unwrap();

        let tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();
        let records = task_run_records_at(&run_path, 5).unwrap();

        assert_eq!(tick.created_run_count, 1);
        assert_eq!(records[0].execution_state, "not-started");
        assert_eq!(records[0].trigger_kind, "schedule-tick");

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn executes_approved_local_task_run_by_generating_candidates() {
        let run_path = temp_history_path("execute-run");
        let candidate_path = temp_history_path("execute-candidates");
        let artifact_path = temp_history_path("execute-artifacts");
        let direction_path = temp_history_path("execute-directions");
        let memory_path = temp_history_path("execute-memory");
        let direction = append_task_direction_at(
            &direction_path,
            "Template products".to_string(),
            "Find useful products.".to_string(),
            4,
            vec!["template".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "template for recurring reports".to_string(),
            Vec::new(),
            0.5,
            "unverified",
        )
        .unwrap();
        let requested = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        review_task_run_at(&run_path, requested.id.clone(), true).unwrap();

        let receipt = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            requested.id,
        )
        .unwrap();

        assert_eq!(receipt.run.execution_state, "completed");
        assert_eq!(receipt.run.lifecycle_state, "succeeded");
        assert!(receipt.run.started_at_ms.is_some());
        assert_eq!(receipt.generated_candidates.len(), 1);
        assert_eq!(receipt.artifacts.len(), 1);
        assert_eq!(
            receipt.artifacts[0].reference_id,
            receipt.generated_candidates[0].id
        );
        assert_eq!(receipt.run.generated_candidate_ids.len(), 1);
        assert!(receipt.run.completed_at_ms.is_some());
        assert_eq!(
            task_candidates_at(&candidate_path, 5).unwrap()[0].task_direction_title,
            "Template products"
        );

        let error = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            receipt.run.id,
        )
        .unwrap_err();
        assert!(error.to_string().contains("already completed"));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn task_loop_acceptance_covers_direction_run_execution_artifact_and_memory_admission() {
        let run_path = temp_history_path("task-loop-acceptance-run");
        let candidate_path = temp_history_path("task-loop-acceptance-candidates");
        let artifact_path = temp_history_path("task-loop-acceptance-artifacts");
        let direction_path = temp_history_path("task-loop-acceptance-directions");
        let memory_path = temp_history_path("task-loop-acceptance-memory");
        let direction = append_task_direction_at(
            &direction_path,
            "Workflow products".to_string(),
            "Find reusable workflow product opportunities.".to_string(),
            5,
            vec!["workflow".to_string(), "template".to_string()],
            "manual".to_string(),
            false,
            "opportunity".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "workflow template for recurring expert reports".to_string(),
            vec!["workflow".to_string()],
            0.6,
            "unverified",
        )
        .unwrap();

        let requested =
            request_task_run_at(&run_path, &direction_path, direction.id.clone()).unwrap();
        assert_eq!(requested.lifecycle_state, "awaiting-approval");
        assert_eq!(requested.execution_state, "not-started");

        let approved = review_task_run_at(&run_path, requested.id.clone(), true).unwrap();
        assert_eq!(approved.lifecycle_state, "approved");
        assert_eq!(approved.execution_state, "approved-not-started");

        let receipt = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            requested.id,
        )
        .unwrap();
        assert_eq!(receipt.run.lifecycle_state, "succeeded");
        assert_eq!(receipt.run.execution_state, "completed");
        assert_eq!(receipt.generated_candidates.len(), 1);
        assert_eq!(receipt.artifacts.len(), 1);
        assert_eq!(
            receipt.artifacts[0].reference_id,
            receipt.generated_candidates[0].id
        );
        assert_eq!(
            receipt.run.generated_candidate_ids,
            vec![receipt.generated_candidates[0].id.clone()]
        );
        assert!(receipt.generated_candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Resolved output template" && item.value == "opportunity"));

        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            receipt.generated_candidates[0].id.clone(),
            "accepted".to_string(),
        )
        .unwrap();
        let promoted = review.promoted_memory_item.unwrap();
        assert_eq!(review.candidate.status, "accepted");
        assert_eq!(promoted.scope, "L1 Working");
        assert_eq!(promoted.item_type, "task-candidate");
        assert_eq!(promoted.admission_state, "accepted");
        assert_eq!(promoted.admission_rule, "task-candidate-review");
        assert!(promoted.tags.contains(&"template:opportunity".to_string()));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn scheduled_task_loop_acceptance_covers_tick_approval_execution_and_memory_admission() {
        let run_path = temp_history_path("scheduled-task-loop-run");
        let candidate_path = temp_history_path("scheduled-task-loop-candidates");
        let artifact_path = temp_history_path("scheduled-task-loop-artifacts");
        let direction_path = temp_history_path("scheduled-task-loop-directions");
        let memory_path = temp_history_path("scheduled-task-loop-memory");
        let mut direction = append_task_direction_at(
            &direction_path,
            "Scheduled workflow products".to_string(),
            "Find scheduled workflow opportunities.".to_string(),
            5,
            vec!["workflow".to_string(), "template".to_string()],
            "daily".to_string(),
            false,
            "opportunity".to_string(),
        )
        .unwrap();
        direction.created_at_ms = 1;
        direction.updated_at_ms = 1;
        write_json_records(&direction_path, &[direction.clone()]).unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "daily workflow template for expert report packages".to_string(),
            vec!["workflow".to_string(), "template".to_string()],
            0.6,
            "unverified",
        )
        .unwrap();

        let tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();
        assert_eq!(tick.created_run_count, 1);
        assert_eq!(tick.skipped_run_count, 0);
        assert_eq!(tick.created_runs[0].trigger_kind, "schedule-tick");
        assert_eq!(tick.created_runs[0].schedule_frequency, "daily");
        assert_eq!(tick.created_runs[0].approval_state, "waiting-approval");
        assert_eq!(tick.created_runs[0].task_direction_id, direction.id);

        let approved =
            review_task_run_at(&run_path, tick.created_runs[0].id.clone(), true).unwrap();
        assert_eq!(approved.lifecycle_state, "approved");
        assert_eq!(approved.execution_state, "approved-not-started");

        let receipt = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            tick.created_runs[0].id.clone(),
        )
        .unwrap();
        assert_eq!(receipt.run.trigger_kind, "schedule-tick");
        assert_eq!(receipt.run.lifecycle_state, "succeeded");
        assert_eq!(receipt.run.execution_state, "completed");
        assert_eq!(receipt.generated_candidates.len(), 1);
        assert_eq!(receipt.artifacts.len(), 1);

        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            receipt.generated_candidates[0].id.clone(),
            "accepted".to_string(),
        )
        .unwrap();
        let promoted = review.promoted_memory_item.unwrap();
        assert_eq!(promoted.scope, "L1 Working");
        assert_eq!(promoted.item_type, "task-candidate");
        assert_eq!(promoted.admission_state, "accepted");
        assert!(promoted.tags.contains(&"template:opportunity".to_string()));

        let second_tick = task_scheduler_tick_at(&run_path, &direction_path).unwrap();
        assert_eq!(second_tick.created_run_count, 0);
        assert_eq!(second_tick.skipped_run_count, 1);

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn persists_failed_state_when_local_execution_work_errors() {
        let run_path = temp_history_path("execute-failed-run");
        let candidate_path = temp_history_path("execute-failed-candidates");
        let artifact_path = temp_history_path("execute-failed-artifacts");
        let direction_path = temp_history_path("execute-failed-directions");
        let memory_path = std::env::temp_dir().join(format!(
            "synapse-execute-failed-memory-directory-{}",
            now_millis()
        ));
        fs::create_dir(&memory_path).unwrap();
        let direction = append_task_direction_at(
            &direction_path,
            "Failing local scan".to_string(),
            "Exercise persisted failure state.".to_string(),
            4,
            vec!["template".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let requested = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        review_task_run_at(&run_path, requested.id.clone(), true).unwrap();

        let error = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            requested.id.clone(),
        )
        .unwrap_err();
        let run = task_run_records_at(&run_path, 5)
            .unwrap()
            .into_iter()
            .find(|record| record.id == requested.id)
            .unwrap();

        assert!(error.to_string().contains("storage io error"));
        assert_eq!(run.lifecycle_state, "failed");
        assert_eq!(run.execution_state, "failed");
        assert!(run.started_at_ms.is_some());
        assert!(run.failed_at_ms.is_some());
        assert!(run.error_summary.is_some());

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_dir(memory_path);
    }

    #[test]
    fn artifact_index_failure_compensates_generated_candidates() {
        let run_path = temp_history_path("artifact-failed-run");
        let candidate_path = temp_history_path("artifact-failed-candidates");
        let artifact_path = std::env::temp_dir().join(format!(
            "synapse-artifact-failure-directory-{}",
            now_millis()
        ));
        let direction_path = temp_history_path("artifact-failed-directions");
        let memory_path = temp_history_path("artifact-failed-memory");
        fs::create_dir(&artifact_path).unwrap();
        let direction = append_task_direction_at(
            &direction_path,
            "Artifact compensation".to_string(),
            "Do not leave orphan candidates.".to_string(),
            4,
            vec!["template".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        append_memory_item_at(
            &memory_path,
            "L0 Session",
            "raw",
            "inspiration",
            "manual-capture",
            "template opportunity".to_string(),
            Vec::new(),
            0.5,
            "unverified",
        )
        .unwrap();
        let requested = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        review_task_run_at(&run_path, requested.id.clone(), true).unwrap();

        let error = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            requested.id.clone(),
        )
        .unwrap_err();
        let run = task_run_records_at(&run_path, 5)
            .unwrap()
            .into_iter()
            .find(|record| record.id == requested.id)
            .unwrap();

        assert!(error.to_string().contains("storage io error"));
        assert_eq!(run.lifecycle_state, "failed");
        assert!(task_candidates_at(&candidate_path, 10).unwrap().is_empty());

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_dir(artifact_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn blocks_execution_when_direction_becomes_inactive() {
        let run_path = temp_history_path("execute-inactive-run");
        let candidate_path = temp_history_path("execute-inactive-candidates");
        let artifact_path = temp_history_path("execute-inactive-artifacts");
        let direction_path = temp_history_path("execute-inactive-directions");
        let memory_path = temp_history_path("execute-inactive-memory");
        let direction = append_task_direction_at(
            &direction_path,
            "Paused products".to_string(),
            "Should not execute after being disabled.".to_string(),
            4,
            vec!["template".to_string()],
            "manual".to_string(),
            false,
            "auto".to_string(),
        )
        .unwrap();
        let requested =
            request_task_run_at(&run_path, &direction_path, direction.id.clone()).unwrap();
        review_task_run_at(&run_path, requested.id.clone(), true).unwrap();
        set_task_direction_active_at(&direction_path, direction.id, false).unwrap();

        let error = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            requested.id,
        )
        .unwrap_err();

        assert!(error.to_string().contains("inactive"));
        assert!(task_candidates_at(&candidate_path, 5).unwrap().is_empty());

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn blocks_online_task_run_before_local_execution() {
        let run_path = temp_history_path("execute-online-run");
        let candidate_path = temp_history_path("execute-online-candidates");
        let artifact_path = temp_history_path("execute-online-artifacts");
        let direction_path = temp_history_path("execute-online-directions");
        let memory_path = temp_history_path("execute-online-memory");
        let direction = append_task_direction_at(
            &direction_path,
            "Online scan".to_string(),
            "Needs web.".to_string(),
            4,
            vec!["news".to_string()],
            "manual".to_string(),
            true,
            "auto".to_string(),
        )
        .unwrap();
        let requested = request_task_run_at(&run_path, &direction_path, direction.id).unwrap();
        review_task_run_at(&run_path, requested.id.clone(), true).unwrap();

        let receipt = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            requested.id,
        )
        .unwrap();

        assert_eq!(receipt.run.execution_state, "blocked");
        assert!(receipt.generated_candidates.is_empty());
        assert!(receipt
            .run
            .detail
            .contains("Online task runs remain blocked"));

        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
    }

    #[test]
    fn accepted_task_candidate_promotes_to_l1_memory() {
        let candidate_path = temp_history_path("accept-candidate");
        let run_path = temp_history_path("accept-candidate-runs");
        let memory_path = temp_history_path("accept-memory");
        let candidate = TaskCandidate {
            id: "candidate-1".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Template products".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Template products -> paid template idea".to_string(),
            score: 0.8,
            score_components: Default::default(),
            matched_keywords: vec!["template".to_string()],
            evidence: vec![evidence("Resolved output template", "opportunity")],
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();

        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "accepted".to_string(),
        )
        .unwrap();

        assert_eq!(review.candidate.status, "accepted");
        assert!(review.candidate.promoted_memory_id.is_some());
        assert_eq!(
            review.promoted_memory_item.as_ref().unwrap().scope,
            "L1 Working"
        );
        assert_eq!(
            review.promoted_memory_item.as_ref().unwrap().item_type,
            "task-candidate"
        );
        assert_eq!(
            review
                .promoted_memory_item
                .as_ref()
                .unwrap()
                .admission_state,
            "accepted"
        );
        assert_eq!(
            review.promoted_memory_item.as_ref().unwrap().admission_rule,
            "task-candidate-review"
        );
        assert_eq!(
            review.promoted_memory_item.as_ref().unwrap().source_trust,
            "reviewed-local"
        );
        assert!(review
            .promoted_memory_item
            .as_ref()
            .unwrap()
            .content
            .contains("Resolved output template: opportunity"));
        assert!(review
            .promoted_memory_item
            .as_ref()
            .unwrap()
            .tags
            .contains(&"template:opportunity".to_string()));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn accepted_deepened_candidate_promotes_lineage_to_l1_memory() {
        let candidate_path = temp_history_path("accept-deepened-candidate");
        let run_path = temp_history_path("accept-deepened-candidate-runs");
        let memory_path = temp_history_path("accept-deepened-memory");
        let candidate = TaskCandidate {
            id: "candidate-2".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Workflow".to_string(),
            memory_item_id: "candidate:candidate-1".to_string(),
            summary: "Deepen Workflow -> productization path".to_string(),
            score: 0.8,
            score_components: Default::default(),
            matched_keywords: vec!["workflow".to_string()],
            evidence: Vec::new(),
            explanation: "deepened".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: Some("candidate-1".to_string()),
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();

        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-2".to_string(),
            "accepted".to_string(),
        )
        .unwrap();

        let memory = review.promoted_memory_item.unwrap();

        assert!(memory.content.contains("Source candidate: candidate-1"));
        assert!(memory
            .tags
            .contains(&"source-candidate:candidate-1".to_string()));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn rejected_task_candidate_does_not_promote_memory() {
        let candidate_path = temp_history_path("reject-candidate");
        let run_path = temp_history_path("reject-candidate-runs");
        let memory_path = temp_history_path("reject-memory");
        let candidate = TaskCandidate {
            id: "candidate-1".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Workflow".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Workflow -> weak idea".to_string(),
            score: 0.3,
            score_components: Default::default(),
            matched_keywords: Vec::new(),
            evidence: Vec::new(),
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();

        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "rejected".to_string(),
        )
        .unwrap();

        assert_eq!(review.candidate.status, "rejected");
        assert!(review.promoted_memory_item.is_none());
        assert!(recent_memory_items_at(&memory_path, 5).unwrap().is_empty());

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(run_path);
    }

    #[test]
    fn deepen_task_candidate_creates_follow_up_run_for_approval() {
        let candidate_path = temp_history_path("deepen-candidate");
        let run_path = temp_history_path("deepen-candidate-runs");
        let memory_path = temp_history_path("deepen-memory");
        let candidate = TaskCandidate {
            id: "candidate-1".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Workflow".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Workflow -> deeper productization path".to_string(),
            score: 0.7,
            score_components: Default::default(),
            matched_keywords: vec!["workflow".to_string()],
            evidence: Vec::new(),
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();

        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "deepen".to_string(),
        )
        .unwrap();

        let follow_up_run = review.follow_up_run.unwrap();

        assert_eq!(review.candidate.status, "needs-deepening");
        assert_eq!(follow_up_run.trigger_kind, "candidate-deepen");
        assert_eq!(follow_up_run.approval_state, "waiting-approval");
        assert_eq!(follow_up_run.execution_state, "not-started");
        assert_eq!(
            follow_up_run.source_candidate_id,
            Some("candidate-1".to_string())
        );
        assert!(!follow_up_run.online_enabled);
        assert_eq!(task_run_records_at(&run_path, 5).unwrap().len(), 1);

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn deepen_task_candidate_reuses_existing_run_after_completion() {
        let candidate_path = temp_history_path("deepen-dedupe-candidate");
        let run_path = temp_history_path("deepen-dedupe-runs");
        let memory_path = temp_history_path("deepen-dedupe-memory");
        let candidate = TaskCandidate {
            id: "candidate-1".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Workflow".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Workflow -> deeper productization path".to_string(),
            score: 0.7,
            score_components: Default::default(),
            matched_keywords: vec!["workflow".to_string()],
            evidence: Vec::new(),
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();

        let first = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "deepen".to_string(),
        )
        .unwrap();
        let run_id = first.follow_up_run.as_ref().unwrap().id.clone();
        transition_task_run_at(&run_path, run_id.clone(), TaskRunTransition::Approve).unwrap();
        transition_task_run_at(&run_path, run_id.clone(), TaskRunTransition::Start).unwrap();
        transition_task_run_at(&run_path, run_id, TaskRunTransition::Complete).unwrap();
        let second = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "deepen".to_string(),
        )
        .unwrap();

        assert_eq!(
            first.follow_up_run.as_ref().unwrap().id,
            second.follow_up_run.as_ref().unwrap().id
        );
        assert_eq!(task_run_records_at(&run_path, 5).unwrap().len(), 1);

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn executes_candidate_deepen_run_by_generating_deeper_candidate() {
        let candidate_path = temp_history_path("execute-deepen-candidates");
        let artifact_path = temp_history_path("execute-deepen-artifacts");
        let run_path = temp_history_path("execute-deepen-runs");
        let direction_path = temp_history_path("execute-deepen-directions");
        let memory_path = temp_history_path("execute-deepen-memory");
        let direction = append_task_direction_at(
            &direction_path,
            "Workflow".to_string(),
            "Deepen workflow ideas.".to_string(),
            4,
            vec!["workflow".to_string()],
            "manual".to_string(),
            false,
            "brief".to_string(),
        )
        .unwrap();
        let candidate = TaskCandidate {
            id: "candidate-1".to_string(),
            created_at_ms: now_millis(),
            task_direction_id: direction.id,
            task_direction_title: "Workflow".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Workflow -> deeper productization path".to_string(),
            score: 0.7,
            score_components: TaskCandidateScoreComponents {
                keyword_score: 0.2,
                priority_score: 0.4,
                memory_confidence: 0.5,
                final_score: 0.7,
            },
            matched_keywords: vec!["workflow".to_string()],
            evidence: vec![
                evidence("Memory scope", "L1 Working"),
                evidence("Resolved output template", "opportunity"),
            ],
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        };
        write_task_candidates(&candidate_path, &[candidate]).unwrap();
        let review = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "deepen".to_string(),
        )
        .unwrap();
        let follow_up_run = review.follow_up_run.unwrap();
        review_task_run_at(&run_path, follow_up_run.id.clone(), true).unwrap();

        let receipt = execute_task_run_at(
            &run_path,
            &candidate_path,
            &artifact_path,
            &direction_path,
            &memory_path,
            follow_up_run.id,
        )
        .unwrap();

        assert_eq!(receipt.run.execution_state, "completed");
        assert!(receipt.run.detail.contains("candidate deepening"));
        assert_eq!(receipt.generated_candidates.len(), 1);
        assert!(receipt.generated_candidates[0]
            .summary
            .starts_with("Deepen"));
        assert_eq!(
            receipt.generated_candidates[0].memory_item_id,
            "candidate:candidate-1"
        );
        assert_eq!(
            receipt.generated_candidates[0].source_candidate_id,
            Some("candidate-1".to_string())
        );
        assert!(receipt.generated_candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Source candidate" && item.value == "candidate-1"));
        assert!(receipt.generated_candidates[0]
            .evidence
            .iter()
            .any(|item| item.label == "Resolved output template" && item.value == "opportunity"));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(run_path);
        let _ = fs::remove_file(direction_path);
        let _ = fs::remove_file(memory_path);
    }

    #[test]
    fn invalid_task_candidate_decision_is_rejected() {
        let candidate_path = temp_history_path("invalid-candidate");
        let run_path = temp_history_path("invalid-candidate-runs");
        let memory_path = temp_history_path("invalid-memory");

        let error = review_task_candidate_at(
            &candidate_path,
            &run_path,
            &memory_path,
            "candidate-1".to_string(),
            "maybe".to_string(),
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("unsupported task candidate decision"));
    }
}
