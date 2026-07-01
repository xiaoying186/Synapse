# Changelog

Public software versions follow SemVer-style numbering.
Internal design document versions are not public release numbers.

## Unreleased

### Added

- Added changelog-driven GitHub Release notes for the manual release workflow.
- Added mandatory Windows installer code signing to the manual release workflow
  before SHA-256 checksum generation and asset upload.
- Added the Cognitive IDE layout with Knowledge, Thinking, and Execution views,
  a left knowledge tree, right context rail, and bottom system monitor / CLI
  activity stream.

## 0.0.1 - Guarded Manual Release Workflow

### Added

- Added repository collaboration baselines for Codex task tracking, Synapse
  fusion tracking, public design notes, and branch/PR workflow guidance.
- Added a read-only Secret Guard scanner and connected it to static preflight.
- Added Agent Harness dry-run previews for repository trust and command safety
  classification.
- Added redacted remote-origin metadata to Agent Harness repository trust
  previews.
- Added disabled Project Radar source descriptors for GitHub Trending,
  OSSInsight, and Hugging Face Trending inside the Data Source Registry preview.
- Added a public Baigong module manifest template for future guarded tools,
  Agents, automation adapters, and data-source connectors.
- Surfaced Secret Guard and Agent repository trust in Production Readiness and
  Security Center capability evidence.
- Added UI smoke coverage for English/Simplified Chinese language switching,
  including persisted language mode and `document.documentElement.lang`.
- Extracted Production Overview preview state and refresh operations from
  `App.tsx` into a focused hook without changing UI behavior.
- Extracted Data Source Registry preview state and refresh operation from
  `App.tsx` into a focused hook, and updated static preflight anchors.
- Extracted Web App Shell, Codebase Memory, and Permission Memory preview state
  and operations from `App.tsx` into a focused hook.
- Added a guarded manual GitHub release workflow for versioned Windows
  installer releases with SHA-256 files.
- Renamed the manual release workflow to `.github/workflows/manual-release.yml`,
  toned down installer availability claims, added Rust check to public baseline
  CI, and removed the obsolete V65 workflow file.

### Changed

- Expanded project agent rules to cover Synapse terminology, bilingual UI copy,
  Git collaboration expectations, and public repository boundaries.
- Repaired internal/private document ignore patterns that had become mojibake.

## 0.0.0 - Initial Public Baseline

- Established Synapse as a local-first guarded desktop prototype.
- Separated public software versioning from internal design alignment.
- Added public safety boundaries, release preflight, release evidence, and UI
  smoke checks.
- Added Taiheng, Zhishu, Xingtai, and Baigong public architecture language.
- Added preview-only Data Source Registry governance.
- Added public repository governance files and issue/PR templates.
- Documented that unrestricted Agent execution, automatic Feishu/WeChat
  delivery, browser write automation, automatic cleanup, automatic L2 writes,
  and cloud sync as a source of truth are not included in this baseline.
