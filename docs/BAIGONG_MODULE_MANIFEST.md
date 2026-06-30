# Baigong Module Manifest Template

Baigong modules describe tools, Agents, automation adapters, and data-source
connectors before Synapse allows them to participate in guarded workflows.

This template is a public baseline contract. It is not an executable plugin
format yet, and it must not contain credentials, local account data, proxy
passwords, or private workflow notes.

## Minimal Shape

```json
{
  "module_id": "baigong.project_radar",
  "name": "Project Radar",
  "status": "preview-only",
  "owner_center": "Baigong",
  "governed_by": "Taiheng",
  "capabilities": [
    {
      "capability_id": "github_trending_projects",
      "type": "data_source_observation",
      "state": "disabled",
      "execution_mode": "read_only_preview"
    }
  ],
  "data_sources": [
    {
      "source_id": "github_trending_projects",
      "registry_required": true,
      "auth_required": false,
      "storage_policy": "quarantine_observation"
    }
  ],
  "permissions": [
    {
      "permission_id": "network.read.public",
      "default_state": "disabled",
      "approval_required": true
    }
  ],
  "admission_policy": {
    "zhishu_write": "review_required",
    "artifact_storage": "quarantine_first",
    "cross_check_required": true
  },
  "safety_gates": [
    "no-credentials-in-manifest",
    "taiheng-permission-review",
    "source-registry-required",
    "secret-guard-before-release"
  ]
}
```

## Required Boundaries

- Capabilities must state whether they are usable, guarded, preview-only,
  dry-run, disabled, or planned.
- Data sources must reference Data Source Registry entries instead of embedding
  connection details.
- Permissions must default to disabled when they involve network, filesystem
  mutation, browser automation, local app launch, external delivery, or Agent
  execution.
- Outputs must enter quarantine before Zhishu admission, durable memory writes,
  or user-facing automation claims.
- Module manifests are public-safe descriptions only; implementation code and
  private strategy notes belong in module-owned directories or private docs.
