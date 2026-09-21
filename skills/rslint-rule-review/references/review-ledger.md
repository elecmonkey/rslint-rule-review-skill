# Rule Review Ledger Template

Copy this template to a temporary or untracked file for each review. Keep concise evidence or links to local artifacts in every row. Add rows as needed; do not delete incomplete rows to make the review appear complete.

## Contents

- [Target Identity](#target-identity)
- [Upstream Identity](#upstream-identity)
- [Upstream-Test Mapping](#upstream-test-mapping)
- [Behavior Matrix](#behavior-matrix)
- [Patch-Risk Map](#patch-risk-map)
- [Differences and Findings](#differences-and-findings)
- [Commands and Artifacts](#commands-and-artifacts)
- [Incomplete Work](#incomplete-work)
- [Completion Gate](#completion-gate)

## Target Identity

| Field | Value | Verified from |
|---|---|---|
| Repository |  |  |
| PR / branch / commit |  |  |
| Base SHA |  |  |
| Head SHA |  |  |
| State and last update |  |  |
| Author and title |  |  |
| Worktree path |  |  |
| Worktree HEAD and cleanliness |  |  |

## Upstream Identity

| Field | Value | Evidence |
|---|---|---|
| Rule and package |  |  |
| Exact version / tag |  |  |
| Implementation |  |  |
| Tests |  |  |
| Documentation |  |  |
| Schema / options |  |  |
| Fixes / suggestions |  |  |
| Intentional differences |  |  |

## Upstream-Test Mapping

Use one row per upstream case or one explicitly enumerated generated group. `Status` must be `direct`, `equivalent`, `excluded`, or `uncovered`.

| Upstream case ID | Input / configuration semantic | Expected diagnostics, ranges, fixes, suggestions | Local evidence | Status and reason |
|---|---|---|---|---|
|  |  |  |  |  |

## Behavior Matrix

| Case ID | Source / filename / shared configuration | Upstream output | Rslint output | Same? | Correctness and repairability decision | Evidence artifact |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

## Patch-Risk Map

| Changed branch or shared contract | Callers / consumers | Normal, inverse, boundary, failure, repeated, concurrent paths | Verification | Result |
|---|---|---|---|---|
|  |  |  |  |  |

## Differences and Findings

| ID | Minimal trigger | Patch attribution | Upstream / Rslint behavior | More-correct behavior | Rslint repairable? | A–D disposition / priority | Location and evidence |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

## Commands and Artifacts

| Purpose | Exact command / tool version | Result | Artifact path |
|---|---|---|---|
|  |  |  |  |

## Incomplete Work

| Check | Attempt | Blocking cause | Required next step | Effect on conclusion |
|---|---|---|---|---|
|  |  |  |  |  |

## Completion Gate

- [ ] Re-read current platform state and confirm the reviewed head SHA is still current.
- [ ] Confirm exact upstream version and read implementation, tests, documentation, and schema from the same tag.
- [ ] Classify every upstream test semantic as direct, equivalent, excluded with a specific reason, or uncovered.
- [ ] Run a real two-sided differential corpus over the selected risk axes with one Rslint build artifact.
- [ ] Minimize and rerun every observed difference.
- [ ] Complete correctness and Rslint-repairability analysis for every difference.
- [ ] Complete the independent patch-risk map, including shared consumers and wiring.
- [ ] Resolve or report every prioritized finding, decision difference, and incomplete check.
- [ ] Confirm the review worktree has no staged or accidentally tracked experimental files.
- [ ] Choose only one conclusion allowed by `review-reporting.md`: pass, changes required, user decision required, or review incomplete.
