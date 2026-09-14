# Environment, Worktrees, and Verification Cost

## Contents

- [Capability Check](#capability-check)
- [Continue When a Helper Script Fails](#continue-when-a-helper-script-fails)
- [Choose a Working Directory](#choose-a-working-directory)
- [Prepare a PR Worktree](#prepare-a-pr-worktree)
- [Reuse a Submodule](#reuse-a-submodule)
- [Temporary Files and Dependencies](#temporary-files-and-dependencies)
- [Build and Test Cost](#build-and-test-cost)
- [Cleanup](#cleanup)

## Capability Check

Creating an isolated worktree, installing lockfile-pinned pnpm dependencies, initializing submodules, downloading modules through shared Go caches, and running focused builds and tests are normal preparation and verification steps for a complete rule review. Proceed with these local actions directly. When tools or sandboxes require approval, use the environment approval mechanism; do not treat it as separate user authorization for the review task.

Before execution, identify the tools actually available in the environment rather than assuming an operating system:

- Git;
- Node.js, for this skill's helper scripts;
- GitHub CLI, when handling a GitHub PR;
- the Go, pnpm/npm, and other tool versions declared by the repository;
- network, package-installation, build, and worktree-write capability.

Use equivalent available capabilities when an optional tool is unavailable. If a necessary command fails because of sandbox or network restrictions, retry through the current environment's escalation mechanism. If a necessary capability remains unavailable after approval attempts, report it as incomplete work. Do not “fix” the environment by rewriting system cache locations or bypassing permission restrictions. External publication always needs separate authorization.

## Continue When a Helper Script Fails

`scripts/*.mjs` are portable convenience tools, not mandatory runtime dependencies or single points of failure. If a helper script fails because of a Node.js version, operating system, hosting platform, path layout, changed CLI output, or local environment state:

1. Read the failed script in full. Identify its intended commands, preconditions, safety invariants, and target postconditions.
2. Determine whether failure occurred during preview, validation, or after a write. Use read-only commands to check whether fetches, directories, or worktrees already exist; never assume that failure means no side effect occurred.
3. Use available Git, hosting-platform CLI, and filesystem operations to reproduce the script effect step by step. Preserve equal or stronger overwrite refusal, exact-revision, and cleanliness checks at every step.
4. Verify the postconditions that the script would have guaranteed, then continue with submodule setup, dependencies, builds, and review.
5. If an optimization path is unavailable, use the standard Git workflow to get a correct result. For example, when submodule object reuse fails, shallow-fetch or shallow-clone only the exact gitlink commit instead of stopping review.

Never skip SHA matching, worktree state, path-boundary, or existing-directory checks merely to simulate success. Report an environment blocker only when the equivalent manual workflow also cannot complete because permissions, objects, or tools are genuinely missing.

## Choose a Working Directory

- When the user provides a worktree, first confirm that `HEAD` matches the target revision and inspect `git status --short`. Do not pull, reset, or align it to a force-pushed head without authorization.
- When the user does not provide a worktree, create an isolated one directly. Prefer a detached checkout at the exact SHA so read-only review does not create a local branch.
- Derive the worktree path from parameters or repository location. Do not assume a home directory, fixed parent directory, drive, or path separator.
- Do not reuse a directory with uncommitted changes, mismatched revision, or unknown provenance.

## Prepare a PR Worktree

The helper script `scripts/prepare-review-worktree.mjs` previews by default:

```text
node scripts/prepare-review-worktree.mjs <PR number> [--repo owner/name] [--repo-root path] [--remote name] [--worktree-root path]
```

After independently checking the repository, PR, SHA, and target directory in the preview, add `--apply`. No additional user question is needed for ordinary worktree creation. The script:

- locates the repository from the current Git repository or `--repo-root`;
- reads PR state and the exact head SHA through `gh pr view`;
- rejects a non-open PR, an existing target directory, and inconsistent fetch results;
- fetches `refs/pull/<PR>/head` from the configured remote;
- creates a detached worktree at the exact SHA;
- does not parse the PR title, create a review branch, or overwrite an existing directory.

If the hosting platform is not GitHub or does not provide `refs/pull/*/head`, use platform-native commands to obtain the exact head SHA, then run an equivalent `git worktree add --detach`.

If the script fails, read `prepare-review-worktree.mjs` and manually reproduce its workflow:

1. Use `git rev-parse --show-toplevel` to identify the local repository and confirm the remote exists.
2. Use the hosting-platform CLI/API read-only to obtain PR state, head SHA, title, and author. Stop for a non-open PR.
3. Choose an isolated directory that does not exist; do not reuse a dirty directory or existing worktree.
4. Fetch the PR head from the selected remote. If GitHub refspecs are unavailable, fetch the head ref/SHA offered by the platform.
5. Compare the locally obtained commit with the exact platform head SHA. Stop on mismatch; do not substitute an approximate branch tip.
6. Run an equivalent detached `git worktree add`, then confirm `HEAD` equals the target SHA and `git status --short` is empty.

If the script failed after `fetch`, a changed `FETCH_HEAD` is an allowed local side effect; reread its SHA and continue. If it already registered or created the target worktree, inspect `git worktree list --porcelain` and the target directory state. Reuse it only when it meets the postconditions. Otherwise preserve the evidence and choose a new directory unless you explicitly confirm it is safe to remove the incomplete worktree you created.

## Reuse a Submodule

When a submodule object database is large, you may reuse objects already present in an initialized checkout. This is an optimization, not a correctness prerequisite. Do not guess the location of a “main worktree.”

For a review worktree, only the exact commit recorded by the superproject gitlink is required. Prefer a shallow clone or shallow fetch at depth 1 for that exact commit. Do not default to, recommend, or silently fall back to a full-history submodule clone.

The helper script requires explicit review-worktree, source-checkout, and relative submodule paths:

```text
node scripts/reuse-submodule-worktree.mjs --review-worktree <path> --source-checkout <path> --submodule typescript-go
```

It previews by default. After independently checking paths and commits, add `--apply`; do not ask the user again. The script validates the gitlink commit, source object, target state, and worktree cleanliness. If the exact commit is absent from the source object database, initialize the target with a depth-1 checkout of that exact gitlink commit.

Do not create a shared worktree concurrently while a normal clone/fetch writes the same object database. Before cleaning a superproject worktree, remove its nested worktree through the source submodule repository.

If the script fails, read `reuse-submodule-worktree.mjs` and manually reproduce its workflow:

1. Locate the review superproject root and confirm `git status --short` is empty before starting.
2. Use `git ls-tree HEAD -- <submodule-path>` to read the exact `160000 commit` gitlink SHA.
3. Use `git -C <source-checkout> cat-file -e <SHA>^{commit}` to verify that the source object database has the commit.
4. Confirm the target is inside the review worktree. If it is already a Git checkout, reuse it only when HEAD exactly matches and state is clean. Refuse to overwrite a non-empty non-checkout target.
5. From the source checkout, run an equivalent `git worktree add --detach <target> <SHA>`.
6. Verify target HEAD, target cleanliness, and superproject cleanliness.

If the object is unavailable, the shared object database does not support worktrees, or the reuse path is unsafe, do not stop review. Initialize only the required commit with a shallow command such as `git submodule update --init --checkout --depth 1 <submodule-path>`, then verify that checkout HEAD matches the gitlink SHA. If the target already has a partial submodule checkout, shallow-fetch the exact SHA with `git -C <submodule-path> fetch --depth=1 origin <gitlink-sha>` before detached checkout.

Do not run a full-history clone as the default fallback. If a depth-1 operation cannot obtain the exact gitlink commit, inspect the remote/ref error and try another shallow exact-commit fetch or the repository's supported shallow submodule form. Escalate the specific limitation rather than silently downloading complete history. If the script might already have created a nested worktree, inspect `git worktree list --porcelain` in the source repository and inspect target state before creating another or removing anything.

## Temporary Files and Dependencies

- Use the runtime's temporary-directory API or a safe temporary-directory command. Do not hardcode `/tmp`, a home subdirectory, or a macOS path.
- Put fixtures, configuration, and differential output in an isolated temporary directory or an explicitly untracked directory in the worktree.
- Use the exact upstream dependency version stated by the PR and the repository lockfile. When dependencies are absent, run the repository's frozen-lockfile install command. Request network or sandbox approval through the environment mechanism when needed.
- Do not overwrite global tools, modify user configuration, or stage temporary files.
- Obtain and reuse Go cache locations through `go env GOCACHE` and `go env GOMODCACHE`. When caches are outside the sandbox, request necessary access for `go build`, `go test`, and module downloads. Do not redirect caches into a worktree or temporary directory.

## Build and Test Cost

Complete static reading, upstream-test mapping, and differential corpus preparation before concentrated dynamic verification:

1. Initialize submodules required by the target revision. Prefer safe reuse of existing objects; when reuse is unavailable, shallow-clone or shallow-fetch only the exact gitlink commit at depth 1.
2. Install workspace dependencies from the lockfile without updating dependencies or the lockfile.
3. Build the smallest artifact needed by the implementation change once. Before JS integration differential tests exercise changed Go code, follow repository guidance and run `pnpm --filter @rslint/core build:bin`.
4. Reuse that artifact for the complete differential corpus.
5. Do not rebuild merely because only fixtures, scripts, or expected results changed.
6. Do not duplicate external diagnostics already covered by the API in lower-level tests. Use lower-level tests for internal contracts unavailable through the API or for shared helpers.
7. Run the target Go package/test, target JS workspace/test files, and representative consumers demonstrably affected by shared changes.
8. Run the corresponding smoke/integration test for catalog, preset, CLI, or configuration loading.
9. Whole-workspace builds and full test suites require a concrete cross-repository risk or a user request; they are not routine steps.

Do not clear shared compilation or dependency caches for troubleshooting. Only address a cache when there is clear evidence of corruption or disk pressure and the user authorizes the specific cleanup target.

## Cleanup

- At review end, confirm there are no staged, committed, or accidentally tracked experimental files.
- Do not automatically remove a user-provided worktree.
- Before removing an isolated worktree, nested submodule worktree, or temporary dependency, confirm no other process uses it and follow user authorization and repository rules.
- Cleanup is a separate action; “review complete” does not automatically authorize removing directories or branches.
