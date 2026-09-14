# Upstream Behavior-Parity Review

## Contents

- [Establish the Contract](#establish-the-contract)
- [Map the Complete Upstream Test Suite](#map-the-complete-upstream-test-suite)
- [Build a Behavior Matrix](#build-a-behavior-matrix)
- [Run a Real Differential Test](#run-a-real-differential-test)
- [Minimize and Attribute Differences](#minimize-and-attribute-differences)
- [Evaluate Correctness and Repairability](#evaluate-correctness-and-repairability)
- [Classify and Handle Differences](#classify-and-handle-differences)
- [Options, Fixes, and Suggestions](#options-fixes-and-suggestions)
- [Completion Standard](#completion-standard)

## Establish the Contract

Use [upstream-repositories.md](upstream-repositories.md) to identify the upstream repository, then use the exact upstream package version as the review baseline. Read the release tag for that version and keep the implementation, tests, documentation, and shared helpers on the same tag. Do not substitute `origin/main`, `main`, `master`, a default branch, HEAD, or current website source for the target release tag. Newer source may provide supplemental context but cannot decide parity.

Record:

- package name, version, or commit;
- rule name, schema, and default options;
- parser, processor, ECMAScript/TypeScript, and file-extension prerequisites;
- message IDs, diagnostic nodes or ranges;
- fix, suggestion, and multi-round behavior;
- intentional differences explicitly stated by the PR.

If the PR does not state an upstream version, inspect the lockfile, package manifest, porting notes, test comments, and commit history. If they still do not determine one uniquely, treat version ambiguity as a blocker instead of selecting a locally available version.

## Map the Complete Upstream Test Suite

Enumerate every target-rule test file and every dynamic test generator. For each `valid`, `invalid`, or equivalent case, record:

- source, filename, and parser settings;
- options, settings, globals, and language options;
- expected diagnostic count, message/messageId, and location;
- output, suggestions, and their outputs;
- the grouping and intent expressed by surrounding comments.

Every upstream case must have one of these states:

1. Directly migrated with equivalent assertion semantics.
2. Equivalently covered by an identifiable, more-general local case.
3. Specifically excluded or reverse-migrated with a reason consistent with confirmed AST, API, framework-capability, or intentional-fork behavior.
4. Uncovered.

State 4 is a test-completeness issue. A vague “not supported” or file-level disclaimer cannot replace a per-case or explicit-group explanation.

Do not compare case counts: merging, splitting, table-driven tests, and generated tests change counts. Compare input space, configuration, and assertion semantics. New edge cases cannot compensate for missing upstream cases.

## Build a Behavior Matrix

Derive test dimensions from every implementation branch and every relevant Rslint/ESLint semantic boundary. Consider at least:

- positive and negative cases, including every early return;
- syntax variations, parentheses, optional chains, computed properties, TS, and JSX;
- local, imported, global, cross-file, and type-aware references;
- default, empty, valid-boundary, multiple-entry, and invalid options;
- comments, whitespace, line breaks, non-BMP characters, and diagnostic ranges;
- single, adjacent, overlapping, and consecutive multi-round fixes;
- suggestion count, message, range, and output;
- source type, file extension, parser options, and malformed source.

For every run, record an input identifier, shared configuration, upstream version, Rslint SHA, both normalized outputs, whether it is an intentional difference, and the conclusion.

## Run a Real Differential Test

A real differential run is the default for rule review. Creating an isolated environment, installing locked dependencies, building, and running focused tests are expected steps; request approval through the environment mechanism when required. Follow these rules:

1. Use the same source, filename, rule options, and as-equivalent-as-possible parser/configuration.
2. Build PR head once and reuse the artifact. Do not rebuild merely because only fixtures or expected results changed.
3. Prefer Rslint's public JS API or real CLI to verify user-observable behavior. Add focused Go tests only when the API cannot expose internal state or when localizing a shared helper.
4. Compare structured diagnostics rather than only formatted text: rule, messageId/message, severity, UTF-16 line/column or range, suggestions, single edits, and final fixed output.
5. Preserve tool versions and commands for reproducibility. Do not mix stale binaries, global ESLint, or dependencies that disagree with the lockfile into a conclusion.

Prefer focused verification to full CI repetition. Do not substitute repeated builds, whole-workspace tests, lint, or formatting for differential behavior evidence. Broaden scope only when a specific cross-repository risk cannot be covered by focused tests.

## Minimize and Attribute Differences

After finding a difference:

1. Pin both versions and the configuration.
2. Remove irrelevant statements, options, and files until the triggering input is minimal.
3. Rerun both sides at least once.
4. Check parser, processor, file selection, globals, source type, Program capability, and cached artifacts.
5. Compare against the exact boundary of the intentional-differences list.
6. Locate the changed condition, range calculation, or wiring path responsible for the behavior.

After technical attribution, do not automatically treat “different from upstream” as a bug or “same as upstream” as correct. Continue with correctness and repairability analysis.

## Evaluate Correctness and Repairability

For every behavior finding—including suspicious behavior shared by both sides and parity differences—answer both questions below.

### 1. Which Behavior Is More Correct?

Independently evaluate rule purpose, public documentation, ECMAScript/TypeScript semantics, reasonable user expectations, diagnostic actionability, and fix safety. Upstream implementation alone is not final proof of correctness.

- Would adopting upstream behavior correct an Rslint defect, or merely reproduce an upstream bug?
- Does upstream output conflict with its own documentation, rule intent, or neighboring cases?
- Is Rslint behavior safer, more precise, or more consistent with language semantics?
- Does the difference only affect a compatibility contract such as message/range, or the rule's actual decision? Even if both semantics are defensible, is compatibility itself a user dependency?

When helpful, inspect newer upstream releases, issues, follow-up fixes, or similar rules as corroboration, but retain the PR-stated version as the parity baseline. If you conclude upstream has a bug, provide a minimal counterexample and specification/rule-intent evidence; do not rely on preference alone.

### 2. Can Rslint Solve It?

Distinguish “not implemented today,” “expensive to implement,” and “the lower-level model truly cannot provide the required information.” Only the third is an inherent limitation.

Check in order:

1. Whether the ts-go AST already retains required tokens, trivia, parent/child relationships, or syntax data.
2. Whether `RuleContext`, comment store, `RefStore`, `Program`, module graph, or `TypeChecker` can obtain the information.
3. Whether the rule or shared Rslint layer can safely supply it without modifying typescript-go.
4. Whether it is unavailable only in source-only, malformed, specific-processor, or checker-less modes.
5. Whether a small experiment or source path proves the limitation instead of inferring it from an API name or a missing current helper.

If a reasonable repair can live in an Rslint rule, helper, Program facade, or execution pipeline, treat the issue as Rslint-repairable. Large effort, a new helper, or absence from the current PR does not make it inherent.

If a genuine typescript-go or parser-information loss creates the limitation, record the layer where it occurs, the missing information, affected inputs, and conditions that could remove it in the future. Do not require the PR to fake parity through unsafe heuristics.

## Classify and Handle Differences

Classify every finding as follows:

| Observation | Independent correctness judgment | Can Rslint solve it? | Handling |
|---|---|---:|---|
| Both sides agree | Both share the same bug | Does not affect classification | B: P0–P3 defect; state upstream has the same bug |
| Sides differ | Upstream behavior is more correct | Yes | A: P0–P3 defect |
| Sides differ | Upstream behavior is more correct | No, proven lower-layer limitation | C: no priority; do not use unsafe heuristics; request recording and a decision |
| Sides differ | Rslint behavior is more correct and upstream has a bug | Yes or no | C: no priority; do not align with upstream; request recording and a decision |
| Sides differ | Neither behavior can be proven more correct | Insufficient evidence | C: no priority; do not make a mechanical change; request recording and a decision |
| Only apparently different | Prerequisites differ, behavior is unobservable, or reproduction fails | Not applicable | D: do not report |

### A. Repairable Rslint Defect

This includes an Rslint/upstream difference where upstream is more correct, and a real regression in upstream-test coverage, wiring, or a compatibility contract. Assign P0–P3 based on impact and put it under “Required fixes.”

### B. Shared Rslint and Upstream Bug

Behavioral equivalence does not exempt a correctness issue. If the current patch introduced the behavior or a new rule actively implements it, report it as a P0–P3 finding and explicitly state: “Upstream has the same bug for this input; repairing it creates an intentional but more correct difference.” Also provide independent correctness evidence so that the departure from upstream is not an unsupported improvement claim.

### C. Parity Difference Not Recommended for Repair

If aligning upstream would reproduce an upstream bug, or a proven typescript-go/execution-model limitation cannot be eliminated at the Rslint layer in this PR:

- Do not add P0–P3 or place it under “Required fixes.”
- Still report it to the user as a review finding under “Differences and decisions.”
- State upstream behavior, Rslint behavior, why repair is not recommended, evidence, and the impact boundary.
- Strongly recommend documenting the specific difference and reason in the PR body, rule documentation, or adjacent test comments.
- Leave the decision to accept the difference and require documentation to the user.

If the author already records the difference accurately in the PR or documentation and tests lock down the boundary, mark it as an explained difference and do not request another decision. Otherwise, present the difference and documentation recommendation to the user; they may require documentation or explicitly accept the current state.

### D. No Material Issue or Disproved Suspicion

Do not report a difference that is only an unobservable internal representation, has incompatible prerequisites, or is disproved by the minimal experiment. Keep it in the internal ledger if useful, but do not add noise to the user report.

## Options, Fixes, and Suggestions

### Options

Test omitted options, empty arrays/objects, every valid branch, boundary values, and combinations separately. Distinguish schema rejection, configuration normalization, and rule runtime behavior. Do not assume Go deserialization, JavaScript truthiness, and the upstream schema are equivalent.

### Fixes

Compare edit selection and final text. Cover trivia, parentheses, semicolons, line endings, adjacent or overlapping edits, consecutive fixable issues, and non-BMP characters. Confirm multi-round execution converges without losing comments, consuming whitespace, or creating syntax errors.

### Suggestions

A suggestion is not an ordinary autofix. Compare each suggestion's messageId/message, count, range, and applied output independently. Do not only verify that the primary diagnostic exists.

## Completion Standard

The behavior-contract track is complete when:

- the exact upstream contract is known;
- every upstream case has an individual state;
- implementation branches map to the behavior matrix;
- relevant platform risks have received two-sided differential coverage;
- every behavior finding is minimized and has completed both the “which behavior is more correct?” and “can Rslint solve it?” analyses;
- every difference is classified A–D; unrecorded category-C differences are presented for user decision. They cannot pass before the user decides, but the user may require documentation or explicitly accept the current state.

Any missing item leaves this evidence track incomplete.
