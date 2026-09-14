# Patch-Correctness Review

## Contents

- [Goal](#goal)
- [Build a Change Map](#build-a-change-map)
- [Recover Contracts and Invariants](#recover-contracts-and-invariants)
- [Review Execution Paths](#review-execution-paths)
- [Check State and Lifetime](#check-state-and-lifetime)
- [Check Boundaries and Wiring](#check-boundaries-and-wiring)
- [Check Performance and Resources](#check-performance-and-resources)
- [Evaluate Test Evidence](#evaluate-test-evidence)
- [Verify Candidate Issues](#verify-candidate-issues)

## Goal

This evidence track does not ask whether behavior matches upstream. It asks whether the patch is correct as Rslint code. Even when Rslint matches upstream for tested inputs, the patch can still break other rules, entry points, Program modes, error paths, or performance.

General review is not a one-pass checklist. First build a model of the change, then verify invariants along real call relationships. Whenever a new dependency or shared consumer appears, extend the change map and revisit relevant paths.

## Build a Change Map

1. Compare the complete base-to-head diff, including renames, deletions, generated files, dependencies, and configuration changes. Do not inspect only the last commit.
2. For every file, state why it changed and what externally observable result it changes. Continue tracing any change whose purpose is unclear.
3. List added or changed functions, types, interfaces, schemas, registrations, presets, generation steps, and test helpers.
4. Search all callers and consumers of every shared symbol. Separate the current-rule path from shared paths used by other rules, CLI, API, LSP, or workers.
5. Identify adjacent code outside the diff that still participates in the new behavior. Review scope follows data flow and calls, not the changed-file list.

Produce a short map: entry point → config/Program → rule/helper → diagnostic/fix → CLI/API/LSP output, plus consumers of every changed node.

## Recover Contracts and Invariants

Recover the contract each change must preserve from types, callers, tests, architecture documentation, and base behavior:

- whether input may be empty, missing, duplicated, invalid, or from a particular Program generation;
- return value, error, nil/empty collection, ordering, and determinism semantics;
- ownership, mutability, cache key, lifetime, and thread safety;
- authoritative source for position encoding, path identity, filename, and source snapshot;
- schema, defaults, compatibility behavior, and failure policy;
- fix/suggestion invariants for original text, comments, trivia, and later rounds.

Replace “the implementation looks plausible” with falsifiable questions: “What happens when the file has only a source-only Program?” “Does the cache identity include the generation?” “Do empty options and omitted options take the same path?”

## Review Execution Paths

For every change, trace at least these paths:

1. **Normal path**: how the common input reaches output.
2. **Inverse path**: where a similar input that must not report or modify exits.
3. **Boundary path**: empty input, first/last node, nesting, duplicates, and extreme but valid configuration.
4. **Failure path**: parsing failure, no checker, invalid configuration, missing dependency, cancellation, or downstream error propagation.
5. **Repeated-execution path**: whether state survives incorrectly across files, Programs, fix rounds, or repeated calls in one process.
6. **Concurrent path**: whether shared objects are immutable; whether lazy initialization, maps, slices, or caches can race or contaminate one another.

Review both downward from callers and upward from changed helpers. Reading a function body alone often misses call ordering, capability prerequisites, and other consumers.

## Check State and Lifetime

Verify in particular:

- that AST, SourceFile, symbol, checker, references, and Program generation all come from the same source;
- that file-, Program-, and process-level caches use correct keys and invalidate at the correct time;
- that listeners, slices, maps, and builders are cleared completely before reuse;
- that early returns, panics, cancellation, and error paths release resources and leave reusable state;
- that shared state is frozen before concurrent reads and lazy construction is safe;
- that fixes rebuilding a Program do not reuse stale nodes, ranges, symbols, or source text.

For lifetime issues, prefer a sequence test such as “run A, then run B”; a single call often cannot expose contamination.

## Check Boundaries and Wiring

### Language and Representation Boundaries

Check conversions between Go, JavaScript, JSON, and ts-go: nil/null/missing fields, number precision, UTF-16 versus byte offsets, path normalization, enums/strings, error serialization, and stable ordering.

### Product Entry Points

Confirm that a new rule or behavior is reachable from every intended entry point: catalog, plugin `all.go`, preset, schema, config resolver, CLI, JS API, LSP, and worker. Rule-package unit tests alone do not prove wiring is correct.

### Compatibility and Shared Impact

For shared-helper changes, list representative consumers and determine whether new prerequisites or behavior break old callers. Check all construction paths for added parameters or defaults, not only the new PR path. For generated files, confirm sources are updated and regeneration is reproducible; do not change only generated output.

### Error Handling

Check whether errors are swallowed, wrapped twice, downgraded, or raised only after partial output is published. Distinguish user configuration errors, source syntax errors, internal invariant failures, and environment errors. Confirm each entry point preserves its existing presentation contract.

## Check Performance and Resources

First determine whether code runs per node, file, Program, fix round, or request, then estimate invocation count after the change. Focus on:

- repeated full-tree scans or TypeChecker round trips inside listeners;
- regex compilation, configuration parsing, string copying, or large allocation inside loops;
- data that could be lazy but is built unconditionally for every rule or file;
- broader lock scope, serialized parallel work, or unbounded caches;
- temporary files, processes, goroutines, file descriptors, and child processes that are not released.

A performance finding requires concrete scale, call frequency, and affected path. Take a small focused benchmark or counter when needed; do not report from intuition alone.

## Evaluate Test Evidence

Build a “code branch → test” mapping for every changed branch and assess:

- whether the test would fail without the repair instead of merely executing code;
- whether assertions cover message, location, count, output, or side effect rather than an overly broad snapshot;
- whether valid cases prevent over-reporting and invalid cases prevent under-reporting;
- whether errors, empty input, repeated execution, shared consumers, and regression paths are covered;
- whether table-driven shared setup hides a material difference;
- whether a fixture actually enters the intended parser, Program, config, and entry point;
- whether new tests live at the repository-required upstream/extras/integration layer.

Treat missing tests as a finding only when a concrete, important behavior contract is unprotected. Describe the regression that is not protected instead of generally demanding more tests.

## Verify Candidate Issues

For every suspicion, close this loop:

1. State trigger, expected behavior, actual behavior, and possible patch attribution.
2. Reproduce it at head with a minimal input and confirm the current build artifact is running.
3. Compare with base when possible to establish that the patch introduced it; otherwise prove causality with a clear code path.
4. Change one critical condition for an inverse test, ruling out configuration, version, cache, or fixture distortion.
5. Check whether the behavior is an author-declared design change with a matching boundary.
6. Reduce it to one actionable finding. If evidence disproves the suspicion, remove it from the result.

Before ending review, reread the full diff and change map so that shared consumers discovered late are not left unchecked.
