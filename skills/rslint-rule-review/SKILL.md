---
name: rslint-rule-review
description: Review Rslint rules ported from ESLint or ESLint plugins. Verify the implementation, complete test semantics, options, diagnostics, suggestions, and autofixes against the specified upstream version, and independently review patch correctness, regressions, performance, and engineering quality. Use for a local branch, commit, diff, or GitHub pull request; also use to prepare an isolated review worktree, create edge cases, run upstream/Rslint differential tests, or publish review results after explicit authorization.
---

# Rslint Rule Port Review

Treat every review as two equally necessary and independent evidence tracks:

1. **Behavior-contract review**: Determine how Rslint differs from the exact upstream version named by the PR, which behavior is more correct, and whether Rslint can address the difference.
2. **Patch-correctness review**: Determine whether the change introduces correctness, regression, performance, or engineering-quality issues even when sampled output matches upstream.

Only conclude that a patch passes once both tracks are complete and no unresolved issue remains.

## Follow Higher-Priority Constraints

- Follow system, user, repository `AGENTS.md`, and runtime permission rules first.
- A complete rule review normally includes local preparation and dynamic verification: create an isolated worktree, install lockfile-pinned pnpm dependencies, initialize or reuse submodules, use shared Go caches through the environment permission mechanism, and run focused Go build/test, JS tests, and two-sided differential tests. Do not ask the user to approve each ordinary, recoverable local step; request system approval when the environment requires it.
- You may create fixtures, temporary tests, and diagnostics in an isolated worktree or temporary directory. You may temporarily edit the reviewed implementation to test a repair hypothesis, then remove your experimental changes. Never overwrite pre-existing changes, commit, push, or modify the author's PR on their behalf.
- Follow lockfiles and repository commands for dependency installation and builds. Do not modify global toolchains, clear shared caches, or create private Go caches to bypass restrictions.
- Publishing a comment, submitting a review, pushing, or any other external write requires explicit authorization for the exact target and material action.

## Read Resources by Task

- For every rule-port review, read [upstream-repositories.md](references/upstream-repositories.md), [upstream-parity.md](references/upstream-parity.md), and [patch-correctness.md](references/patch-correctness.md) in full. Before building a behavior matrix or patch-risk map, read [review-patterns.md](references/review-patterns.md) and select counterexample axes relevant to the rule's dependencies and change scope. Read relevant sections of [rslint-runtime-risks.md](references/rslint-runtime-risks.md) for the capabilities the rule uses.
- Read [environment-and-worktrees.md](references/environment-and-worktrees.md) when creating a worktree, initializing a submodule, building, or running differential tests.
- `scripts/*.mjs` are convenience tools. If any script fails, read its workflow, inspect side effects it may have produced, and use available environment commands to reproduce its equivalent effect as described in [environment-and-worktrees.md](references/environment-and-worktrees.md). Do not stop the review merely because a helper script failed.
- Read [review-reporting.md](references/review-reporting.md) in full when forming findings, making an overall judgment, drafting comments, or preparing publication.

## Identify the Review Target

1. Locate the target repository and read its root `AGENTS.md`, any closer `AGENTS.md`, and the target revision's root `architecture.md`. Rslint **uses a different AST and execution model from ESLint**: it consumes the native typescript-go AST directly and does not build an ESTree compatibility layer. Rules execute through Rslint `Program`, `RuleContext`, listener dispatch, `RefStore`, and a per-file `TypeChecker`. At minimum, read `Parsing Pipeline`, `Abstract Syntax Tree (AST)`, `Lint Rule Framework`, and `Diagnostics & Autofixes` in `architecture.md`, then trace changed behavior into `internal/program/`, `internal/program/loader/`, `internal/linter/`, and `internal/rule/`. Do not directly transplant upstream node, scope, parser-service, or fixer assumptions.
2. Identify the review baseline and target revision. For a PR, record the number, base SHA, head SHA, state, author, title, body, commits, complete diff, existing reviews, and discussion. If the PR is merged or its head changed, report that state before reaching a conclusion from an obsolete revision.
3. Use [upstream-repositories.md](references/upstream-repositories.md) to identify the upstream repository. Record the rule name, upstream package, exact version, supported options, fix/suggestion behavior, and relevant shared components. Read the release tag for that version. Never substitute upstream `origin/main`, a default branch, latest source, or an unrelated locally installed version.
4. Check worktree state. Never overwrite or clean changes that existed before review started; prefer an isolated worktree or temporary directory for dynamic verification.
5. Maintain an intentional-differences list. Accept only specific evidence from the PR body, code, tests, documentation, or an explicit author response. Record Rslint behavior, upstream behavior, and the boundary of each difference. Vague disclaimers and unanswered discussions are not exemptions.

## Maintain a Review Ledger

Maintain these records during review:

- **Upstream-test mapping**: the local test, equivalent coverage, or specific exclusion reason for every upstream case.
- **Behavior matrix**: input, shared configuration, upstream version and output, Rslint revision and output, and conclusion.
- **Patch risks**: changed branches, shared call sites, boundary/error paths, and verification evidence.
- **Difference decisions**: which upstream or Rslint behavior is more correct, whether Rslint can repair it, final category, and evidence.
- **Incomplete work**: checks not performed because of missing permissions, dependencies, environment capability, or information.

Similar test counts do not prove complete migration, and green existing tests do not prove behavioral equivalence.

## Evidence Track 1: Behavior Contract

1. Read the specified upstream rule implementation, schema, documentation, and all test files.
2. Map every `valid`, `invalid`, option, diagnostic count and location, message, output, suggestion, and standalone regression case.
3. Read the Rslint implementation, tests, rule registration, preset, configuration parsing, and relevant shared helpers. Associate every implementation branch with the corresponding upstream contract and tests.
4. Prepare differential inputs for relevant AST, scope, Program, parser/configuration, error-recovery, diagnostic-location, option, fix, and suggestion boundaries.
5. Run upstream and PR head using the same source, filename, parser prerequisites, configuration, and rule options. Compare complete normalized output and reuse the same build artifact while expanding the corpus.
6. Reduce every difference to an independent minimal reproduction and rerun it on both sides. Rule out wrong versions, stale artifacts, configuration, parser, processor, and file-selection false differences.
7. Apply the correctness and repairability analysis in [upstream-parity.md](references/upstream-parity.md) to every behavior finding. Do not mechanically pursue equivalence: separately determine whether upstream behavior is more correct and whether Rslint can address the difference.
8. Use four dispositions: a repairable Rslint defect is P0–P3; a shared upstream/Rslint bug is still a priority finding and must state that upstream has the same bug; a difference that would reproduce an upstream bug or is a proven lower-layer limitation is unprioritized and not recommended for repair, but belongs under “Differences and decisions” with a strong recommendation to document it in the PR or documentation and ask the user to decide; do not report a difference with no material impact or one disproved by evidence.

If required tools, dependencies, or builds remain unavailable after normal initialization and permission requests, complete the source and test mapping that is possible, explicitly mark dynamic differential testing incomplete, and never describe static inference as verified fact.

## Evidence Track 2: Patch Correctness

Independently inspect the diff and adjacent call sites for:

- nil values, boundaries, error paths, state lifetimes, caches, concurrency, and resource release;
- AST-range, scope, and type-information assumptions against Rslint's actual model;
- options/schema, rule registration, presets, configuration loading, and documentation wiring;
- `rslint-schema.json` is not a per-rule catalog and does not need an update for an ordinary rule port. Its generic rule-ID patterns and `RuleValue` accept registered rule configuration; do not request or flag a schema update merely because a rule was added. Review or update it only when the PR changes top-level configuration structure, language options, or shared configuration-validation semantics;
- safe and stable fixes/suggestions with no destructive overlap that converge over multiple rounds;
- shared-helper or framework changes with demonstrable impact on other rules;
- unnecessary full-tree scans, repeated parsing, allocations, or type queries on hot paths;
- tests that truly cover changed branches, failure paths, and regressions instead of merely generating snapshots.

Use [patch-correctness.md](references/patch-correctness.md) to inspect the change surface, contracts and invariants, call chains, state lifetimes, cross-language boundaries, wiring, performance, and test validity. A candidate issue must state a concrete trigger, code path, and impact, then be proven or disproven with a minimal test or reproduction. Compare base and head where useful to establish patch causality. Do not skip this track because no upstream mismatch was observed.

## Decide Findings

A prioritized defect enters P0–P3 only when all of these hold:

1. The current patch introduced it or clearly expanded its impact.
2. It materially affects correctness, compatibility, performance, security, or maintainability.
3. Its trigger and affected code can be stated concretely without relying on unstated author intent.
4. It is discrete and actionable; the author would likely fix it after learning about it.
5. Evidence distinguishes a real defect from an environment, version, or configuration difference. An upstream shared bug does not change this threshold.

An unprioritized parity difference that is not recommended for repair does not use P0–P3, but must still be reproducible, bounded, and evidence-backed. Report it as a non-blocking finding for user decision rather than silently discarding it. Ignore style preferences and unproven speculation. Do not stop after the first issue; report every prioritized defect and every undocumented decision difference after both evidence tracks are complete.

## Completion Threshold

Only give `LGTM` or “patch is correct” when all of these hold:

- The exact upstream version and target revision are confirmed.
- Every upstream implementation branch and test semantic is mapped.
- Every omitted or reverse-migrated case has a specific, valid explanation.
- A real two-sided differential run covers relevant high-risk boundaries.
- Every behavior finding has independent correctness and Rslint-repairability analysis.
- The independent patch-correctness review is complete.
- There are no unexplained differences, prioritized defects, or blocking incomplete checks; every difference not recommended for repair has been shown to the user and received an explicit decision. Documentation in the PR, rule docs, or adjacent test comments is strongly recommended; if the user explicitly accepts the difference without requiring documentation, lack of documentation alone does not block approval. A pending user decision cannot pass.

If analysis is complete but an unprioritized difference still needs a user decision, report “user decision required.” If evidence is insufficient to complete analysis, report “review incomplete” and list confirmed facts, remaining checks, and their causes. Never use “no issues found” to hide a pending decision or an evidence gap.

## Output and Publication

- By default, use the concise human-readable report in [review-reporting.md](references/review-reporting.md): state the conclusion and required fixes first, then verification evidence and incomplete work. Produce a machine-readable schema only when the caller explicitly requests one.
- Anchor a finding to the shortest range overlapping the diff where possible; use an overall comment for cross-cutting or test-completeness issues.
- Drafting text does not authorize publication. Before publishing, show the exact target, action, and final text. Send it verbatim only after explicit user approval, then read it back and compare it.
- Follow [review-reporting.md](references/review-reporting.md) and higher-priority repository requirements for publication language, wording, priority, and output adaptation.
