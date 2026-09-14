# Rslint Rule-Port Review Patterns

## Contents

- [How to Use This Reference](#how-to-use-this-reference)
- [Review Priority](#review-priority)
- [Find the Semantic Adaptation Layer First](#find-the-semantic-adaptation-layer-first)
- [Review ASTs as Semantic Projections](#review-asts-as-semantic-projections)
- [Review Names by Binding](#review-names-by-binding)
- [Treat Unknown as a First-Class State](#treat-unknown-as-a-first-class-state)
- [Recover the Full Upstream Helper Contract](#recover-the-full-upstream-helper-contract)
- [Treat Execution Phase and Order as Inputs](#treat-execution-phase-and-order-as-inputs)
- [Do Not Approximate JavaScript with Go Semantics](#do-not-approximate-javascript-with-go-semantics)
- [Treat Fixes as Source Transformers](#treat-fixes-as-source-transformers)
- [Include Configuration and Product Wiring in Rule Behavior](#include-configuration-and-product-wiring-in-rule-behavior)
- [Evaluate Test Evidence](#evaluate-test-evidence)
- [Review the Blast Radius of Shared Helpers](#review-the-blast-radius-of-shared-helpers)
- [Cover Platform, VFS, and Parser Recovery](#cover-platform-vfs-and-parser-recovery)
- [Check Hot Paths and Recursive Termination](#check-hot-paths-and-recursive-termination)
- [Generate Counterexamples Again After Fixes](#generate-counterexamples-again-after-fixes)
- [Compositional Counterexample Matrix](#compositional-counterexample-matrix)
- [Shortcuts That Produce False Conclusions](#shortcuts-that-produce-false-conclusions)

## How to Use This Reference

Use this reference to decide where to seek the next counterexample. It does not replace the target rule's upstream source, complete test mapping, or real differential test. Patterns can overlap and evolve with the architecture.

1. Understand the upstream AST, scope, helper, configuration, and fix contracts used by the rule.
2. Select relevant risk axes below.
3. Combine two or three axes at a time to create paired positive and negative cases; do not mechanically expand the full Cartesian product.
4. After finding a difference, use [upstream-parity.md](upstream-parity.md) to decide which behavior is more correct and whether Rslint can repair it.

## Review Priority

Choose review order from the rule's dependencies. Check fundamental semantic boundaries every time; investigate specialized paths when the rule depends on them; treat test completeness and reverse validation after a fix as completion gates.

| Priority | Inspect first |
|---|---|
| Always | AST semantic projection; binding/scope; options/config/preset; complete diagnostic/fix output |
| Deep when used | static evaluation; TypeChecker/source-only behavior; JS/Unicode/RegExp/numeric semantics; shared helpers |
| Expand when touched | CFG/execution order; module resolution and cross-platform paths; VFS/LSP/API; recursion and hot paths |
| Always as a gate | per-case upstream-test mapping, assertion strength, integration collection, and reverse regression checks after fixes |

Do not skip a path directly relevant to the current diff merely because a pattern is uncommon. Risk follows the rule's dependencies and change scope.

## Find the Semantic Adaptation Layer First

Rule-port failures often occur not in the most visible conditional, but in an adaptation layer it depends on: AST-shape normalization, scope/reference emulation, static evaluation, property-name resolution, token/range recovery, configuration normalization, or fix assembly. Even when rule body logic resembles upstream line by line, a narrow adaptation-layer contract can create a whole family of false positives or false negatives.

Start review by drawing:

```text
Upstream node/service/helper
        ↓ semantic mapping
Rslint AST / Program / shared helper
        ↓
Rule branch → diagnostic / fix / suggestion
```

For every arrow, ask whether its input domain is complete, what information is discarded, how unknown propagates, and whether callers assume a stronger guarantee. Prioritize places where multiple upstream helpers collapse into one local boolean decision, or where a local analyzer was written only for the current case.

## Review ASTs as Semantic Projections

Do not build a static “one ts-go kind equals one ESTree type” table. The real mapping is often one-to-many or many-to-one and can vary by position. Parentheses, optional chains, TypeScript assertions, `satisfies`, non-null assertions, decorators, synthesized JSDoc nodes, JSX, bodyless signatures, and computed names may disappear upstream, form wrappers, or change parent/child boundaries.

High-value checks:

- For every branch that directly reads `Parent`, `Kind`, `Pos`, `End`, or a fixed ancestor depth, add transparent, opaque, and nested wrappers.
- Test the same syntax separately as a callee, receiver, assignment target, property key, decorator, parameter, type annotation, and initializer.
- Draw actual ts-go enter/exit traversal order. A member's decorator, computed key, parameter, type, and body do not necessarily belong to the same upstream execution frame.
- If upstream has a virtual or synthetic node, do not merely give a physical node another type name. Recreate its parent/child links, fields, range, selector behavior, enter/exit events, and report order.
- When authored TypeScript wrappers and ts-go synthesized JSDoc wrappers need opposite treatment, distinguish their origins.

After repairing one counterexample, move the same semantic feature to adjacent positions rather than adding only one `case` for the original node.

## Review Names by Binding

The same name does not mean the same binding, and finding a symbol does not mean finding the definition upstream would select. Approximating lexical scope with text, a file-level map, or a single checker symbol easily creates systematic misclassification.

For every path that identifies globals, imports, framework APIs, components, props, aliases, or types by name, check:

- same-name bindings in outer and inner scopes, sibling blocks, parameter initializers, computed keys, decorators, namespaces, switches, class-expression self bindings, and function-expression self bindings;
- `var` hoisting, block bindings, type/value/namespace spaces, merged declarations, type-only imports, re-exports, and global augmentation;
- declarations before and after use, multiple declarations, and source-order “first/latest” selection;
- local declarations, cross-file checker fallback, `.d.ts`/lib globals, configured globals, and explicit `off`;
- aliases through destructuring, member paths, qualified names, const indirection, and pass-through expressions;
- whether source-only and typed Programs should choose the same binding or whether upstream intentionally uses per-file scope.

Explain results using binding identity, scope, and declaration order. A file-level `map[name]`, a rightmost-name match, or “the checker resolved it” is usually too broad.

## Treat Unknown as a First-Class State

The most dangerous type and static-classification errors are often not a missed target but prematurely classifying an unprovable input as target or non-target. `unknown` should be a stable third state, not an empty value awaiting a guessed fallback.

Check:

- source-only, typed, JS, TS, missing-symbol, missing-checker, and cross-file-symbol classifications separately;
- how union/intersection, conditional, mapped, recursive alias, literal type, tuple, heritage, and generic constraint combine states;
- ordering of syntax and checker classifiers, and whether a broader checker result overrides an upstream explicit syntax target/skip;
- whether upstream stops, conservatively opens, or conservatively closes for opaque calls, dynamic properties, unsupported annotations, and unknown validators;
- whether a cycle guard only prevents recursion but forgets completed results, or whether a fixed depth budget rejects long but acyclic input.

Having a TypeChecker is not inherently closer to upstream. More information can introduce cross-file definitions, over-expand types, or incorrectly narrow inputs upstream intentionally keeps opaque.

## Recover the Full Upstream Helper Contract

A rule may call only one upstream helper, while that helper carries most of the behavior. Common defects arise when only the helper's current example is copied instead of its input domain and stopping conditions. Pay particular attention to scope/reference trackers, PatternVisitor, static evaluation, side-effect checks, property-name evaluation, component detection, code paths, and token APIs.

Review steps:

1. Follow the upstream call chain to the lowest helper actually used; do not infer behavior from a function name.
2. Enumerate the node families that the helper accepts, rejects, passes through, and returns as unknown.
3. Confirm whether it receives scope. Static evaluation with and without scope may intentionally differ.
4. Check mutation, aliases, pass-through behavior, side effects, getters, and cycle semantics.
5. Search for an existing Rslint shared implementation. If a second local implementation is added, compare the two input domains.

Do not claim a general static evaluator from a whitelist of a few built-ins, and do not replace a complete upstream tracker with broad conditions such as “has a local binding” or “is a CallExpression.”

## Treat Execution Phase and Order as Inputs

Many differences occur because information is correct but available too early or too late. Source-order traversal, Program exit, listener enter/exit, fix generation, and Program rebuilding can all change behavior.

Check:

- whether a later import, type declaration, propTypes assignment, or component assignment should affect an earlier node;
- whether upstream aggregates at `Program:exit` while Rslint decides during traversal;
- which scope/frame evaluates decorators, computed keys, parameter defaults, field types, and initializers;
- whether multiple declarations use first, latest, merge, or all semantics;
- real/upstream event ordering for RHS, computed keys, defaults, writes, `finally`, and label back edges in CFG;
- whether a new Program generation after fixes still uses stale nodes, ranges, symbols, source, or caches.

Generate paired cases where A appears before B and B before A. If reordering unrelated declarations changes the result, cache keys, precollection, or binding selection are often wrong.

## Do Not Approximate JavaScript with Go Semantics

Across-language ports often use similarly named Go standard-library operations with different semantics. Important boundaries include:

- UTF-16 code units versus runes/UTF-8 bytes; astral characters, lone surrogates, and identifier escapes;
- JavaScript case conversion, relational comparison, `String()`, truthiness, trim, and line terminators;
- Number rounding, exponent formatting, radix literals, negative zero, NaN, and BigInt string parsing;
- RegExp grammar, flags, Unicode mode, word boundaries, capture names, character classes, and edition gates;
- locale-sensitive comparison;
- ordinary object prototype behavior versus a true string map.

Whenever code uses `strings.*`, `unicode.*`, Go regexp, `strconv`, rune slices, or a local sorter, inspect repository `internal/utils/ecmascript`, Unicode, and regexp helpers first. Add focused differential inputs with non-BMP characters, lone surrogates, unusual whitespace, every line ending, radix/large numbers, and flagged regexes.

## Treat Fixes as Source Transformers

A correct diagnostic does not prove a correct fix. Fixes can generate invalid code, change semantics, lose modifiers/generics/comments, or duplicate/consume text when combined with adjacent edits.

For every fix or suggestion, check:

- whether the range is based on authored tokens or a physical node containing decorators, type arguments, parentheses, BOM, or trivia;
- whether replacement neighbors need spaces, semicolons, parentheses, or line breaks to avoid token merging and ASI changes;
- whether async, generator, modifiers, type parameters, computed keys, rest/default/destructuring are fully preserved;
- whether comments and directives should remain, move, or make the fix unavailable; text resembling a comment inside a string/regexp is not a comment;
- whether adjacent diagnostics insert duplicate spaces/markers in the same round and whether overlap behavior differs from upstream;
- whether suggestion messageId, data, count, range, and output are complete rather than only the primary diagnostic;
- whether one application parses, repeated execution converges, and final text matches individual-edit behavior.

Run at least three observations: no fix, individual edits, and final multi-round output. Reparse the result. If upstream itself produces a broken fix, do not mechanically copy it; record the difference through the difference-decision workflow.

## Include Configuration and Product Wiring in Rule Behavior

Rule-package tests can pass while the product remains unusable. Trace every real entry point:

- distinguish omitted, empty, `null`, explicit false/off, and defaults;
- ensure every schema-accepted value parses correctly and runtime RegExp flags agree with schema validation;
- verify that `ecmaVersion`, `sourceType`, globals, lib, parser options, settings, and filename/extension reach the rule;
- inspect rule catalog, plugin registry, recommended/unopinionated presets, explicit disables, and legacy-config behavior;
- verify JS integration test registration and that fixtures actually run in the expected JS/TS/JSX/CJS mode;
- compare CLI, API, LSP, and plugin-worker requirements for diagnostics, fixes, and suggestions.

“Explicit configuration works” does not prove the preset is correct. “A Go test contains the case” does not prove the JS test runner collects the file.

## Evaluate Test Evidence

The most subtle test-migration defect is often not a missing test file, but preserving input while weakening assertion semantics. Check:

- whether upstream standalone cases, snapshots, generated groups, and skipped cases enter the mapping;
- whether placeholders or empty cases impersonate original source;
- whether messageId, data, message, count, order, range, suggestions, and output are weakened;
- whether valid cases actually reach the target branch and invalid cases fail if the repair is removed;
- whether filename, source type, parser, project, lib, globals, and settings match expectation;
- whether the runner collects the test file and snapshots come from the current binary;
- whether shared-helper changes run representative consumers instead of only the new rule.

For important regressions, add a counterproof: temporarily remove the critical condition or compare base/head to confirm the test catches the difference. Case count and green tests cannot replace a branch-to-assertion map.

## Review the Blast Radius of Shared Helpers

Relaxing a shared helper to fix one rule can repair the target case while breaking other callers. Pay particular attention to scope/ref, AST wrapper, static evaluator, property-name, token, strict-mode, component-detector, and fix helpers.

For every shared change:

1. Search all callers and group them by the semantics they depend on.
2. Separate general fact from caller-specific policy. Meaning, scope, or fallback valid for only one rule must not enter an unconditional shared path.
3. Run representative tests for at least one positive consumer and one inverse consumer.
4. Check that cache keys, generation, source file, and capability correctly isolate callers.
5. If parallel PRs duplicate the same repair, prefer a unified abstraction and revalidate every path instead of preserving long-term drift.

A local compatibility patch must not alter global IPC, serialization, or all rule-option semantics unless every cross-language consumer is traced.

## Cover Platform, VFS, and Parser Recovery

Treat platform and source medium as first-class inputs for file and module rules:

- Windows/POSIX separators, drive letters, case sensitivity, `path.relative`, roots, and expected diagnostic paths;
- package exports/imports, order among module directories, builtin-module sets, workspace globs, and TypeScript path wildcards;
- disk, overlay VFS, API `lintText`, LSP documents, and memory snapshots after fixes. Do not bypass `Program` to read a physical file;
- malformed/recovery ASTs, missing arguments, empty NodeLists, and whether the linter should suppress the rule. Attack every direct index or forced cast with incomplete source.

Passing locally does not prove cross-platform correctness. If behavior depends on host filesystem behavior while upstream defines logical path semantics, pin the expected behavior instead of following the current OS.

## Check Hot Paths and Recursive Termination

Performance issues often hide where a correct helper runs in a per-node or per-diagnostic loop: scanning tokens from file start, scanning the remainder of a file for every comment, walking parameters/scope per call, or using `visiting` only to prevent cycles without caching completed results.

First label invocation frequency: per run, Program, file, node, diagnostic, or fix round. Then check:

- whether an index or cache can be created at file/rule initialization;
- whether sorted tokens/comments can use binary search or an advancing cursor;
- whether memo keys contain true semantic identity rather than splitting equivalent results;
- whether cycle detection and completed memoization are separate;
- whether deferred fixes/suggestions are created only when the consumer requests them;
- whether a performance repair changes traversal order or unknown semantics.

Report performance only with scale and invocation evidence. Use a small input to verify that optimized behavior remains semantically equivalent.

## Generate Counterexamples Again After Fixes

When a patch fixes only the original snippet rather than its semantic family, or broadens a guard and creates an inverse regression, one retest cannot prove the problem is solved. After every author update, do more than rerun the original example:

1. Rebuild or confirm that the latest head artifact is running.
2. Rerun the original reproduction and a control case that changes one critical condition.
3. Generate inverse input for every widened or narrowed guard.
4. Move the same semantic feature to a sibling node, adjacent scope, source-only/typed mode, and JS/TS mode.
5. Run representative consumers when a shared helper changed.
6. Compare complete diagnostics/fixes/suggestions, not only counts.
7. Reread the diff and confirm tests lock down the root cause rather than the original string.

“Previous issues are fixed” starts a new review round. The latest repair can create a new alias, side effect, cache, ordering, or fix issue.

Treat review state as process metadata, not correctness proof:

- resolved only means a thread was handled; it does not prove the repair is correct or no sibling omission remains;
- outdated only means anchored lines changed; the issue can survive at a new location;
- after a fixed/addressed response, reproduce on the referenced commit instead of trusting the statement;
- approval/LGTM covers only the SHA reviewed at that time. When head changes, inspect the new diff and regressions of previous findings first;
- when a reviewer retracts or corrects a finding, preserve the evidence that changed the conclusion and turn it into a new control case.

## Compositional Counterexample Matrix

Choose values from each row, preferring pairwise or three-way combinations:

| Axis | Values |
|---|---|
| Representation | bare, parenthesized, optional, computed, authored TS wrapper, synthesized JSDoc wrapper |
| Position | callee, receiver, key, decorator, parameter/default, type, initializer, nested function |
| Binding | global, local, shadowed, alias, reassigned, type-only, namespace, merged, cross-file |
| Capability | source-only, typed, JS, TS, JSX/TSX, script/module/commonjs |
| Configuration | omitted, empty, boundary, invalid, explicit off, non-default parser/lib/version |
| Text | comment, directive, CRLF, U+2028/U+2029, BOM, astral/lone surrogate, escaped identifier |
| Output | no report, one/many diagnostics, fix, suggestion, adjacent fixes, multi-round output |
| Order | declaration before/after, first/latest definition, enter/exit, before/after rebuild |
| Platform | POSIX, Windows, case-sensitive/insensitive, disk/overlay |

Start with combinations around the rule's most important semantic gate, then expand to sibling cases from observed differences. Do not substitute a massive random corpus for a targeted matrix.

## Shortcuts That Produce False Conclusions

- “Similar node names mean equivalent semantics.”
- “Matching a name means finding the target API.”
- “A TypeChecker symbol is necessarily more accurate.”
- “A difference from upstream must be an Rslint bug.”
- “Agreement with upstream must be correct.”
- “Documentation calls it an intentional difference, so it needs no revalidation.”
- “The input was migrated, so test coverage is complete.”
- “Output parses, so the fix is safe and equivalent.”
- “The target rule test passes, so a shared helper has no regression.”
- “CI passed on one platform, so path and line-ending behavior is portable.”
- “A helper script or first differential attempt failed, so dynamic verification cannot continue.”

Turn these statements into falsifiable hypotheses and design minimal positive and negative cases. High-quality review identifies the abstraction boundary that creates a family of bugs instead of memorizing individual bugs.
