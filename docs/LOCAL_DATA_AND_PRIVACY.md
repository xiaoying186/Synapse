# Local Data And Privacy

Synapse is local-first. The `0.0.0` public baseline is designed to keep
prototype data on the local machine unless a future feature explicitly says
otherwise and passes review gates.

## Local Data

Installed desktop builds store data under the current user's application-data
directory, with `.synapse/` as the default relative data directory. Development
and non-Tauri tools use `.synapse/` in the repository workspace. This directory
is ignored by Git and should not be committed. Set `[storage].data_dir` in
`synapse.config.toml` to another non-empty relative directory or a local
absolute disk path such as `E:\Synapse\.synapse`. Network/UNC paths, disk roots,
and `..` traversal are rejected to prevent an accidental storage escape.

For an installed desktop build, an optional `synapse.config.toml` placed in the
application-data directory is the runtime configuration source. On first
launch, Synapse creates this local template with guarded defaults and never
overwrites an existing file. Development continues to use the workspace
configuration file.

The Settings page can change only the local mode, data directory, and scheduler
cadence. It previews the requested values, requires an explicit restart-aware
confirmation, synchronizes a sibling `.bak` copy before atomically replacing
the active file, and does not expose
external delivery, Agent execution, script execution, or relay switches.

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
