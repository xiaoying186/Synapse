# Codex Workflow

This workflow keeps Synapse development repeatable and reviewable.

## Daily Start

```powershell
cd S:\My\Synapse2.0
git status --short --branch
git checkout main
git pull --rebase origin main
git checkout -b codex/<task-name>
codex
```

If Git HTTPS is temporarily unavailable, do not start broad feature work until
the local and remote branch state is understood.

## Standard Codex Prompt

```text
Read AGENTS.md, README.md, TODO-CODEX.md, TODO-SYNAPSE-FUSION.md, CHANGELOG.md,
and the relevant docs file.

Handle only the first high-priority TODO-CODEX.md task that applies.

Requirements:
1. Do not make unrelated refactors.
2. Do not edit secrets, proxy settings, account settings, or local path config.
3. Explain the patch plan before editing.
4. Run focused checks after editing.
5. Summarize changed files, verification, and risks.
6. Do not commit or push unless explicitly asked.
```

## Verification Defaults

Use the smallest useful checks for the touched surface:

```powershell
npm.cmd run i18n:check
npm.cmd run build
npm.cmd run preflight:static
```

For release work, also use:

```powershell
npm.cmd run preflight:release
npm.cmd run tauri:build
npm.cmd run release:sha256
npm.cmd run release:evidence
npm.cmd run release:status -- --json
```

## Branch And PR Flow

```powershell
git status
git diff
git add -A
git commit -m "feat: short description"
git push -u origin codex/<task-name>
gh pr create --base main --head codex/<task-name> --title "feat: short description" --body "Codex implemented the scoped task."
```

Use direct `main` pushes only when the user explicitly asks for them.

## Public Repository Boundaries

Do not commit:

- `.env`, tokens, keys, certificates, webhook URLs, or account configuration.
- Local memory stores, chat logs, databases, caches, logs, or generated data.
- Full internal design documents, monetization plans, private roadmaps, or local
  personal workflows.
- MSI/EXE/ZIP build artifacts, except through GitHub Releases.

Use `docs/` for public summaries and keep internal materials outside the public
repository.
