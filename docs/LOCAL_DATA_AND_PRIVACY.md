# Local Data And Privacy

Synapse is local-first. The `0.0.0` public baseline is designed to keep
prototype data on the local machine unless a future feature explicitly says
otherwise and passes review gates.

## Local Data

Development data may be stored under `.synapse/` in the repository workspace.
This directory is ignored by Git and should not be committed.

Typical local records include:

- plan history;
- memory and Zhishu review candidates;
- task directions and task run records;
- source observation history;
- audit events and snapshots;
- local SQLite repository state.

## What Is Not Uploaded

The public baseline does not upload local data to a cloud service. Relay upload
is disabled/dry-run only and is not a source of truth.

## Sensitive Data Boundaries

Do not commit:

- `.synapse/`;
- `.env` or `.env.*`;
- SQLite/database files;
- local logs;
- screenshots containing private data;
- installer artifacts;
- private design documents or local path notes.

## Diagnostics

Computer diagnostics are read-only in this baseline. They must not delete
files, edit registry values, change system settings, or collect sensitive local
content by default.

## Future Changes

Any future feature that reads broader local data, sends external requests, or
syncs between devices must update `docs/CLAIM_BOUNDARIES.md`,
`docs/CAPABILITY_MATRIX.md`, and the release preflight.
