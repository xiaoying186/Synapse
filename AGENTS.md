# AGENTS.md

## Work Style

- Keep context small. Do not scan the whole repository unless explicitly asked.
- Prefer narrow, targeted changes over broad refactors.
- Before larger edits, first provide a minimal patch plan:
  - files to inspect or modify
  - intended changes per file
  - risks
  - smallest useful verification command
- Do not modify unrelated files.
- Do not run full test suites or builds unless requested or clearly necessary.
- If commands are needed, prefer the smallest relevant command.
- At the end of substantial work, include a next-step prompt under 100 characters when useful.

## Default Scope Limits

- Avoid reading or modifying these unless the task explicitly requires it:
  - `node_modules/`
  - `dist/`
  - `build/`
  - `.cache/`
  - `.venv/`
  - `__pycache__/`
  - `logs/`
  - `data/`
  - `dataset/`
  - `backtest_results/`
  - `coverage/`
  - large generated files such as `*.csv`, `*.parquet`, `*.sqlite`, `*.log`, `*.zip`

## Tool Use

- Use CodeGraph for structural code questions:
  - where symbols are defined
  - what calls what
  - impact of changing a function/class
  - signatures and source for known symbols
  - focused architecture or flow context
- Use native search only for literal text queries, file listings, comments, logs, or when CodeGraph is unavailable.
- Prefer `rg` for text/file search when native search is needed.
- Avoid browser, image, GitHub, database, or other heavy tools unless the task requires them.

## Testing

- Prefer targeted tests, for example:
  - `pytest tests/test_specific_file.py -q`
  - a single package or module build
  - a focused lint/typecheck for touched files
- Avoid full commands such as `pytest`, `npm test`, `pnpm build`, or full lint unless requested.
- If tests are not run, state the minimal verification command.

## Coding Rules

- Follow existing project patterns.
- Keep comments brief and only where they clarify non-obvious logic.
- Do not introduce new abstractions unless they remove real complexity or match an existing pattern.
- Preserve user changes and do not revert unrelated work.
- Use ASCII by default unless the file already uses non-ASCII or the content requires it.

## Prompting Preference

When asking Codex to work on this project, prefer this shape:

```text
Goal:
[one sentence]

Allowed to read:
- [file or directory]

Do not read:
- node_modules/
- dist/
- build/
- logs/
- data/
- .venv/
- backtest_results/

Requirements:
1. Analyze first; do not edit code yet.
2. Output the minimal patch plan.
3. Do not scan the whole repository.
4. Do not run full tests.
5. Prefer small patches and avoid unrelated refactors.
```
