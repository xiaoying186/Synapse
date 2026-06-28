# Synapse Versioning

Synapse separates public software versions from internal design document
versions.

## Current Tracks

| Track | Current value | Purpose |
| --- | --- | --- |
| Public software version | `0.0.0` | Version exposed by `package.json`, Cargo, Tauri, installers, and public release notes |
| Public stage | `Initial Public Baseline` | Human-readable release stage for the private/public repository baseline |
| Internal design alignment | `Synapse Design V6.6` | Internal architecture/design target used for planning and implementation review |

## Rules

- Do not use internal V-series design versions as public software versions.
- Public artifacts, package metadata, installer names, and GitHub release notes
  should use the public software version.
- Internal planning documents may keep their own V-series names, but code and
  release gates should describe them as design alignment references.
- Public repository documents should avoid using internal V-series names as
  primary filenames.

## Current Public Claim

Synapse `0.0.0` is a local-first public baseline aligned with internal
`Synapse Design V6.6`. It is not a claim that all Design V6.6 capabilities are
implemented for daily production automation.
