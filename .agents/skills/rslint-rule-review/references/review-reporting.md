# Review Conclusions and Publication Rules

## Contents

- [Form Findings](#form-findings)
- [Report Parity Differences](#report-parity-differences)
- [Priority](#priority)
- [Inline Comments](#inline-comments)
- [Overall Judgment](#overall-judgment)
- [Default Report Structure](#default-report-structure)
- [External Publication](#external-publication)

## Form Findings

Use one finding for each independent issue. The title should describe the incorrect outcome or required action. The body should explain in one paragraph:

- the input, configuration, or environment needed to trigger it;
- how current code reaches the incorrect result;
- actual upstream and Rslint behavior, or other reproducible evidence;
- the impact on users, compatibility, or other callers.

The body should let the author reproduce and evaluate the issue without guessing. Keep the tone objective, concise, non-accusatory, and proportionate. Give a repair direction only when it is genuinely useful.

For a behavior difference, use this structure when useful, but do not mechanically add every label:

```text
Reproduction: minimal source and shared configuration
Upstream (package@version): actual result
Rslint (revision): actual result
Impact: why this is an observable incompatibility
```

If Rslint and upstream agree for the input but independent analysis confirms that both have the same bug, report it as a normal prioritized defect. Explicitly state that upstream has the same issue and that repair creates an intentional but more correct difference. Support that statement with rule purpose, language semantics, documentation, or another independent source.

## Report Parity Differences

After correctness and repairability analysis, report a difference that is not recommended for repair to the user as a finding, but do not add a `[P0]`–`[P3]` label or include it under “Required fixes.” Use this structure:

```markdown
### <difference title>

Upstream: <package@version and behavior>
Rslint: <current behavior>
Assessment: Do not change behavior solely to pursue parity.
Reason: <alignment reproduces an upstream bug or is a proven lower-layer limitation>
Boundary: <affected and unaffected input scope>
Recommended record: <specific PR body, rule documentation, or test-comment location>
```

For a lower-layer limitation, also state whether it lies in typescript-go, parser information, Program capability, or another layer, and why a reasonable Rslint rule/helper/execution-layer solution is unavailable. For an upstream bug, explain why Rslint's current behavior is more correct. Explicitly ask the user to decide whether to accept the difference and require the author to document it.

## Priority

- **P0**: Unconditionally blocks release or creates widespread catastrophic impact; it does not rely on special input assumptions.
- **P1**: Likely affects a primary use case, creates a serious error, or requires immediate next-cycle treatment.
- **P2**: Produces incorrect behavior for a concrete and realistic input; fix at normal priority.
- **P3**: Has limited impact but remains a real issue the author would likely want to fix.

Priority depends on trigger breadth and impact, not repair difficulty. Omit it rather than inventing precision when it cannot be determined reliably.

## Inline Comments

- If added or changed lines directly cause the issue, anchor the comment to the shortest range overlapping the diff.
- Keep ranges to roughly 5–10 lines or fewer; do not repeat unnecessary file paths and line numbers in the body.
- Use an overall comment for cross-file issues, broad test gaps, or issues that cannot reasonably anchor to one line.
- Use a suggestion only for exact replacement code that the author can apply directly, preserving the exact indentation of the replaced lines.
- Do not submit a fix or combine independent issues into one comment.

## Overall Judgment

Distinguish four states:

1. **Patch is correct**: both evidence tracks are complete and there are no prioritized defects, unexplained differences, pending decisions, or blockers.
2. **Patch is incorrect**: at least one valid finding breaks correctness, compatibility, or a required test contract.
3. **User decision required**: no prioritized defect exists, but a parity difference not recommended for repair remains unhandled and the user must decide whether to accept it and require documentation.
4. **Review incomplete**: evidence is insufficient for a reliable judgment, for example because the exact upstream version is unknown, tests cannot be read completely, or required tools, network, dependencies, or build environment remain unavailable after attempts and permission requests.

Do not treat non-blocking style, spelling, or documentation issues alone as evidence that a patch is incorrect. Do not promote “no findings” automatically to “patch is correct.”

## Default Report Structure

Default to a human-readable report. Do not output JSON or expose the internal ledger. Omit empty sections. If both prioritized defects and parity differences not recommended for repair exist, include both “Required fixes” and “Differences and decisions”; the overall conclusion remains “Changes required.”

### Required Fixes Exist

```markdown
Conclusion: Changes required

## Required fixes

### [P2] <issue title>

<One paragraph covering trigger, actual error, evidence, and impact.>

Location: `path/to/file.go:123`

## Differences and decisions

### <unprioritized difference title>

<Upstream behavior, Rslint behavior, reason not to repair, impact boundary, and recommended documentation location. Ask the user to decide whether to accept it and require documentation.>

## Verification summary

- Upstream baseline: <package@version or commit>
- Reviewed revision: <SHA>
- Executed: <key builds, tests, differential scope, and results>
- Upstream test mapping: <completion status>

## Incomplete work

- <missing verification and reason; omit this section when none remains>
```

Sort findings by severity, then by impact breadth and code path within the same priority. Keep each issue independent. For long reproductions, retain only the minimum code and commands needed.

### Only Parity Differences Not Recommended for Repair

```markdown
Conclusion: User decision required

No prioritized implementation defect was found, but undocumented behavior differences remain.

## Differences and decisions

### <unprioritized difference title>

Upstream: <package@version and behavior>
Rslint: <current behavior>
Assessment: Do not change behavior solely to pursue parity.
Reason: <alignment reproduces an upstream bug or is a proven lower-layer limitation>
Boundary: <impact scope>
Recommended record: <location>

Decide whether to accept this difference and require the author to document it in the PR or documentation.

## Verification summary

- <upstream baseline, revision, differential evidence, and limitation verification>
```

### No Findings and Complete Review

```markdown
Conclusion: Pass

No issue requiring an author change was found.

## Verification summary

- Upstream baseline: <package@version or commit>
- Reviewed revision: <SHA>
- Upstream test mapping: <complete mapping result>
- Differential verification: <behavior dimensions and result>
- Patch review: <reviewed call chains, shared consumers, and risk paths>
- Executed: <key commands and results>
```

### Insufficient Evidence

```markdown
Conclusion: Review incomplete

There is not enough evidence to determine whether the patch is correct.

## Confirmed

- <facts confirmed by source, tests, or execution>

## Remaining verification

- <missing item, attempted action, failure cause, and required next step>
```

Do not write `LGTM` or “no issues” when a user decision is required or the review is incomplete. Do not repeat the entire test matrix to fill a template; report key coverage and reproducible evidence, and provide the detailed ledger only when the user asks for it.

If the caller explicitly requests GitHub inline comments, a particular machine-readable schema, or another format, use that format without changing the finding threshold or completion standard.

## External Publication

Publication is an external write separate from review. Follow these rules strictly:

1. Prepare a local draft first.
2. Determine publication language from target-repository instructions. If the repository requires English, prepare final English text first.
3. Show the user the exact target, action, and final text. A source-language description or “review this for me” is not publication authorization.
4. Publish only after the user explicitly approves the text, target, and action.
5. Before writing, verify the actual payload matches the approved text byte-for-byte. Do not append a summary, links, or checklist at the last moment.
6. Prefer a body file or explicit JSON input so shell escaping cannot alter the text.
7. Immediately read the published resource back and compare its body. Stop on a mismatch; do not write again without authorization.

Building, testing, creating a worktree, or receiving tool permission does not authorize publication.
