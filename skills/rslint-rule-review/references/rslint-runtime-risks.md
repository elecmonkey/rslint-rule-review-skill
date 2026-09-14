# Rslint Runtime Risk Index

## Contents

- [How to Use This Reference](#how-to-use-this-reference)
- [AST and Text Ranges](#ast-and-text-ranges)
- [Scope, Symbols, and Type Information](#scope-symbols-and-type-information)
- [Program and Execution Eligibility](#program-and-execution-eligibility)
- [Parser and Configuration](#parser-and-configuration)
- [Diagnostics, Fixes, and Suggestions](#diagnostics-fixes-and-suggestions)
- [Options and Schema](#options-and-schema)
- [Shared State and Performance](#shared-state-and-performance)

## How to Use This Reference

Rslint and ESLint/TypeScript-ESLint **do not use the same AST, scope, or execution model**. Rslint consumes the native typescript-go AST directly and does not build an ESTree compatibility layer for native rules. It executes rules through its own `Program` facade, one DFS listener dispatch, `RuleContext`, `RefStore`, and per-file `TypeChecker`. A port review must therefore map each upstream ESTree node, eslint-scope/parser-service dependency, and fixer semantic to Rslint rather than infer behavior from similar names.

At the target revision, first read these sections of the repository-root `architecture.md`:

- `Parsing Pipeline`: Program construction, source-only/typed capability, listener dispatch, and malformed-source policy;
- `Abstract Syntax Tree (AST)`: ts-go nodes, trivia, ranges, comments, and UTF-16 positions;
- `Lint Rule Framework`: `Rule`, `RuleContext`, `RefStore`, `TypeChecker`, and listener lifetime;
- `Diagnostics & Autofixes`: diagnostics, suggestions, edit conflicts, and the multi-round fix pipeline.

Then trace changes into `internal/program/`, `internal/program/loader/`, `internal/linter/`, `internal/rule/`, and the target plugin/helper implementation. `architecture.md` is an entry point and contract description, not a source-code replacement. If section names or implementations changed at the target revision, defer to documentation and code at that same revision.

Prepare at least one focused case for every capability the rule actually depends on. Mark clearly irrelevant sections as “not applicable” with a short reason.

## AST and Text Ranges

Rslint uses the typescript-go AST, while ESLint rules usually see ESTree or a TypeScript-ESLint AST. They are not equivalent. Check:

- node kinds, parent/child relationships, and missing-node representation;
- optional chains, computed properties, decorators, JSX, and TypeScript nodes;
- whether parentheses are retained and how syntax ancestors are found;
- whether `Pos()` and `End()` include leading trivia;
- the difference between token, comment, and complete-node ranges;
- conversion among UTF-16 offsets, byte offsets, and Unicode code points.

For diagnostics and fixes, use the token/range nearest to upstream semantics. Do not assume a node start is ESTree `range[0]`. Include comments, distinct line endings, parentheses, and emoji when checking location stability.

## Scope, Symbols, and Type Information

Confirm whether the rule consumes syntax declarations, binder data, reference storage, or a TypeChecker. Focus on:

- shadowing, hoisting, TDZ, and function/block scope;
- import/export, namespace, and type-only symbols;
- globals, environment declarations, and `.d.ts`;
- cross-file references and source-only Programs;
- property names, labels, and type positions accidentally treated as variable references;
- whether fallback without a TypeChecker is equivalent and safe.

Test local declarations, imports, globals, unresolved names, cross-file references, and behavior with and without tsconfig. Do not assume a production path has a TypeChecker merely because one test environment does.

## Program and Execution Eligibility

A rule may run with different Program capabilities or be skipped because of file policy or syntax errors. Confirm:

- source-only versus typed Program capabilities;
- JS, TS, JSX, TSX, CJS, MJS, and declaration-file selection;
- whether malformed source produces a recovery AST and whether the rule should run;
- whether a missing project/tsconfig should degrade, skip, or report configuration error;
- whether third-party plugins and native rules share the same eligibility threshold.

Distinguish “the rule did not report” because of rule logic from rule non-registration, configuration miss, or executor suppression.

## Parser and Configuration

The ESLint side may use parsers, processors, flat config, and file matching, while Rslint has its own loading and parsing pipeline. Align these before comparing:

- `ecmaVersion`, `sourceType`, globals, and parser options;
- file paths, extensions, ignore/include rules;
- virtual source supplied by processors such as Vue or Markdown;
- inline directives, multiple config entries, and severity normalization;
- CJS/MJS top-level scope and module inference.

Confirm that the rule actually executes on both sides before comparing diagnostics.

## Diagnostics, Fixes, and Suggestions

Compare `messageId`/message, data interpolation, severity, count, order, and location. Location tests should include multibyte characters, non-BMP characters, CRLF, and leading trivia.

For fixes:

- verify that edit ranges do not overlap or exceed bounds;
- preserve comments, whitespace, parentheses, and syntax-required delimiters;
- compare individual edits and final text after multiple fix rounds;
- check adjacent diagnostics, newly exposed diagnostics, and convergence.

For suggestions, compare every suggestion's message and output independently. Do not treat a suggestion as an automatically applied fix.

## Options and Schema

Rslint JSON normalization, Go type assertions, and default-value logic may differ from JavaScript and the upstream schema. Check:

- omitted options, empty options, and partial fields;
- boolean, number, string, array, and object boundaries;
- `null`, extra fields, and wrong types;
- override or merge behavior across multiple configuration entries;
- consistency among schema, documentation, tests, and implementation;
- whether invalid configuration is rejected at load time or silently degrades at runtime.

## Shared State and Performance

When a rule or helper caches an AST, Program, symbol, or configuration, confirm that its lifetime cannot leak across files, runs, or concurrent tasks. Check shared map/slice concurrency safety and state left after reuse.

Performance findings need a concrete path and scale argument. Prioritize:

- repeated whole-tree traversal inside a visitor;
- repeated symbol/type queries per node;
- regular-expression compilation, configuration parsing, string copying, or large allocation inside loops;
- unconditional construction of data that could be lazy for every rule or file;
- broader lock scope, serialized parallel work, or unbounded caches;
- temporary files, processes, goroutines, file descriptors, or child processes that are not released.

Do not report “possibly slow” without proof. State input scale, invocation count, and affected consumers; take a focused measurement when needed.
