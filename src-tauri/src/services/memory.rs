use crate::store;

pub fn capture_inspiration(
    content: String,
    tags: Vec<String>,
) -> Result<store::MemoryItem, String> {
    let content = content.trim().to_string();

    if content.is_empty() {
        return Err("Inspiration cannot be empty.".to_string());
    }

    store::append_inspiration(content, tags)
        .map_err(|error| format!("Inspiration could not be saved: {error}"))
}

pub fn capture_experience(
    content: String,
    tags: Vec<String>,
    experience_type: String,
) -> Result<store::MemoryItem, String> {
    let content = content.trim().to_string();

    if content.is_empty() {
        return Err("Experience record cannot be empty.".to_string());
    }

    store::append_experience(content, tags, experience_type)
        .map_err(|error| format!("Experience record could not be saved: {error}"))
}

pub fn capture_zhishu_item(
    content: String,
    tags: Vec<String>,
    item_kind: String,
) -> Result<store::MemoryItem, String> {
    let content = content.trim().to_string();

    if content.is_empty() {
        return Err("Zhishu item cannot be empty.".to_string());
    }

    store::append_zhishu_item(content, tags, item_kind)
        .map_err(|error| format!("Zhishu item could not be saved: {error}"))
}

pub fn recent_items() -> Result<Vec<store::MemoryItem>, String> {
    store::recent_memory_items(8).map_err(|error| format!("Memory is unavailable: {error}"))
}

pub fn review_item(memory_id: String, decision: String) -> Result<store::MemoryItem, String> {
    let memory_id = memory_id.trim().to_string();

    if memory_id.is_empty() {
        return Err("Memory item id cannot be empty.".to_string());
    }

    store::review_memory_item(memory_id, decision)
        .map_err(|error| format!("Memory item could not be reviewed safely: {error}"))
}

pub fn rollback_snapshot(snapshot_id: String) -> Result<store::MemoryRollbackReceipt, String> {
    let snapshot_id = snapshot_id.trim().to_string();
    if snapshot_id.is_empty() {
        return Err("Snapshot id cannot be empty.".to_string());
    }

    store::rollback_memory_item_snapshot(snapshot_id)
        .map_err(|error| format!("Zhishu snapshot could not be restored safely: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_inspiration_before_store_write() {
        let error = capture_inspiration("  ".to_string(), Vec::new()).unwrap_err();

        assert_eq!(error, "Inspiration cannot be empty.");
    }

    #[test]
    fn rejects_empty_experience_before_store_write() {
        let error =
            capture_experience("  ".to_string(), Vec::new(), "success".to_string()).unwrap_err();

        assert_eq!(error, "Experience record cannot be empty.");
    }

    #[test]
    fn rejects_empty_zhishu_item_before_store_write() {
        let error =
            capture_zhishu_item("  ".to_string(), Vec::new(), "knowledge".to_string()).unwrap_err();

        assert_eq!(error, "Zhishu item cannot be empty.");
    }

    #[test]
    fn rejects_empty_memory_review_id_before_store_write() {
        let error = review_item("  ".to_string(), "accepted".to_string()).unwrap_err();

        assert_eq!(error, "Memory item id cannot be empty.");
    }
}
