# Synapse 0.0.0 Public Baseline Release Checklist

Internal design alignment: `Synapse Design V6.6`

Use this checklist before treating a local build or GitHub snapshot as ready for
guarded production use.

## Static Gates

- `npm.cmd run preflight:static` passes.
- `VERSIONING.md` separates the public software version from internal Design
  V6.6 iteration documents.
- `docs/CAPABILITY_MATRIX.md`, `docs/CONFIG_CAPABILITY_MATRIX.md`,
  `docs/CLAIM_BOUNDARIES.md`, and
  `docs/SOURCE_REGISTRY.md` are present and protected by preflight.
- `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`
  are present so CI can reproduce npm and Rust dependency resolution.
- `@tauri-apps/api`, `tauri`, and `tauri-build` remain on the documented
  pinned baseline unless they are upgraded together.
- `synapse.config.toml` keeps `external_delivery_enabled = false`.
- `synapse.config.toml` keeps `agent_execution_enabled = false`.
- `[sync.relay].enabled = false`.
- Feishu and WeChat webhook URLs are empty.
- Tauri CSP is not `null`.
- Tauri bundle target is MSI for the Windows local baseline.

## Build Gates

- `npm.cmd run preflight` passes.
- `cargo fmt --check` passes through the full preflight and GitHub baseline CI.
- `npm.cmd run smoke:ui` passes; when Playwright is available, desktop and
  mobile screenshots are captured under `.tmp/ui-smoke/`.
- Windows MSI release packaging has WiX available on PATH or pre-cached for
  Tauri bundling.
- `npm.cmd run wix:diagnose` passes on the release machine before MSI
  packaging.
- `npm.cmd run tauri -- build --debug` can produce a debug MSI.
- Release MSI builds are verified separately before distribution.
- Signing, hash, and distribution notes in `docs/RELEASE_DISTRIBUTION_NOTES.md`
  are followed before sharing an MSI outside private local testing.
- `npm.cmd run release:evidence` produces local JSON/Markdown release evidence;
  a non-zero exit means release blockers are still present.
- `.tmp/release-evidence/release-evidence.json` includes a top-level
  `release_review` object for machine-readable release state, blockers, and
  artifact readiness.
- `.tmp/release-evidence/release-evidence.json` includes `schema_version: 1`.
- `npm.cmd run release:status` reports the latest `release_review` decision
  before publishing.
- `npm.cmd run release:status -- --json` returns the same decision for
  automation.
- `npm.cmd run release:status` reports no stale evidence inputs after the latest
  release-relevant source, configuration, or documentation changes.
- `npm.cmd run release:doctor` is reviewed for a read-only summary of Git, WiX,
  preflight, and current evidence/status checks without regenerating evidence.
- `npm.cmd run release:doctor -- --json` returns the same read-only doctor
  decision for automation.
- `.tmp/release-evidence/release-summary.md` is reviewed before publishing
  release notes or a GitHub snapshot.
- Release review confirms any debug MSI under `src-tauri/target/debug/` is only
  a packaging rehearsal and is not distributed as the formal release artifact.
- Release evidence includes the documentation-boundary summary for the release
  checklist, distribution notes, README, and public-baseline capability matrix.

## Runtime Gates

- Production Readiness panel is `ready-local`, or every review item is understood
  and accepted.
- Library Home shows no active or failed Saga transaction.
- Security Center has recent audit evidence for high-risk changes.
- Restore points exist before import, rollback, allowlist, or registry changes.

## Repository Gates

- `npm.cmd run preflight:release` passes.
- `npm.cmd run preflight:release:json` has no failed checks if you need
  machine-readable release diagnostics.
- The `Synapse 0.0.0 Public Baseline` GitHub Actions workflow passes after the
  repository is published with a token that can update workflows. It verifies
  local baseline gates, not MSI signing or packaging.
- `npm.cmd run git:diagnose` reports a valid repository, or you intentionally
  initialize a fresh repository after removing an empty `.git` directory.
- If `.git` is empty and no history must be preserved, use
  `npm.cmd run git:bootstrap` first, then explicitly run
  `npm.cmd run git:bootstrap -- --repair-empty-git --yes`.
- `git status --short` lists only intentional source and documentation changes.
- `.codegraph/`, `.synapse/`, `dist/`, `target/`, MSI bundles, local databases,
  and logs are not committed.
- No SMTP credentials, webhook URLs, `.env` files, or local user data are
  committed.
- Do not include internal design documents, monetization plans, private
  roadmaps, local paths, personal workflows, or unpublished module strategies
  in the public repository.
- GitHub release notes describe this as a guarded local-first baseline and avoid
  claiming internal-design non-goals as shipped features.

## Non-Goals For This Baseline

- No direct CLI Agent execution.
- No one-click real Agent team execution.
- No automatic Feishu or WeChat delivery.
- No automatic social publishing.
- No automatic C drive cleanup or system file deletion.
- No automatic L2 writes without explicit review.
