# Environment, Worktrees, and Verification Cost

## Contents

- [Capability Check](#capability-check)
- [Continue When a Helper Script Fails](#continue-when-a-helper-script-fails)
- [Choose a Working Directory](#choose-a-working-directory)
- [Prepare a PR Worktree](#prepare-a-pr-worktree)
- [Prepare a Shallow Submodule](#prepare-a-shallow-submodule)
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
5. For a required submodule, fetch only the exact gitlink commit with the bundled shallow-checkout helper. Do not fall back to an unbounded `git submodule update --init` clone.

Never skip SHA matching, worktree state, path-boundary, or existing-directory checks merely to simulate success. Report an environment blocker only when the equivalent manual workflow also cannot complete because permissions, objects, or tools are genuinely missing.

## Choose a Working Directory

- When the user provides a local worktree, or an existing review worktree is clearly discoverable through `git worktree list --porcelain`, prefer reusing it rather than creating another copy.
- Before reviewing a reused worktree, read the current PR head SHA from the hosting platform, fetch that head, compare it with the worktree `HEAD`, and inspect `git status --short`. Review only an exact match for the current PR head.
- If a dedicated, clean review worktree is behind the current PR head and can be updated through a non-destructive fast-forward, update it and verify the resulting `HEAD` exactly matches the fetched PR head.
- If the existing worktree is dirty, is not clearly dedicated to the target review, or cannot fast-forward because the PR was force-pushed or histories diverged, do not overwrite, reset, or clean it. Preserve it and create a separate isolated worktree at the exact current PR head.
- When no suitable existing worktree is available, create an isolated one directly. Prefer a detached checkout at the exact SHA so read-only review does not create a local branch.
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

## Prepare a Shallow Submodule

Large submodules must be initialized by fetching only the exact gitlink commit. Do not run an unbounded `git submodule update --init` during review, and do not depend on or mutate another checkout's submodule object database.

The helper requires the review worktree and relative submodule path:

```text
node scripts/prepare-shallow-submodule.mjs --review-worktree <path> --submodule typescript-go
```

It previews by default. After checking the target, URL, and gitlink SHA, add `--apply`; do not ask the user again. It creates an independent repository inside the submodule path, runs `git fetch --depth=1 --no-tags origin <gitlink SHA>`, checks out that SHA detached, and verifies exact revision, shallow state, target cleanliness, and superproject cleanliness. It refuses to overwrite any non-empty target that is not already an aligned clean shallow checkout.

If the script fails, read `prepare-shallow-submodule.mjs` and manually reproduce its workflow:

1. Locate the review superproject root and confirm `git status --short` is empty before starting.
2. Use `git ls-tree HEAD -- <submodule-path>` to read the exact `160000 commit` gitlink SHA.
3. Read the matching URL from `.gitmodules`; stop if URL resolution is ambiguous.
4. Confirm the target is inside the review worktree and empty. Reuse an existing target only when it is shallow, clean, and exactly at the gitlink SHA.
5. In the empty target, run `git init`, add the submodule URL as `origin`, fetch the exact SHA with `--depth=1 --no-tags`, verify `FETCH_HEAD`, and check it out detached.
6. Verify target HEAD, `--is-shallow-repository`, target cleanliness, and superproject cleanliness.

If a previous attempt left a partial or misaligned target, preserve and inspect it. Do not overwrite, clean, or delete it automatically. Use a fresh review worktree, or remove that exact confirmed partial checkout only with explicit authorization, then rerun the helper.

## Temporary Files and Dependencies

- Use the runtime's temporary-directory API or a safe temporary-directory command. Do not hardcode `/tmp`, a home subdirectory, or a macOS path.
- Put fixtures, configuration, and differential output in an isolated temporary directory or an explicitly untracked directory in the worktree.
- Use the exact upstream dependency version stated by the PR and the repository lockfile. When dependencies are absent, run the repository's frozen-lockfile install command. Request network or sandbox approval through the environment mechanism when needed.
- Do not overwrite global tools, modify user configuration, or stage temporary files.
- Obtain and reuse Go cache locations through `go env GOCACHE` and `go env GOMODCACHE`. When caches are outside the sandbox, request necessary access for `go build`, `go test`, and module downloads. Do not redirect caches into a worktree or temporary directory.

## Build and Test Cost

Complete static reading, upstream-test mapping, and differential corpus preparation before concentrated dynamic verification:

1. Initialize required submodules with `prepare-shallow-submodule.mjs`, fetching only each exact gitlink commit. Never use an unbounded submodule clone as review preparation.
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
- Before removing an isolated worktree, shallow submodule checkout, or temporary dependency, confirm no other process uses it and follow user authorization and repository rules.
- Cleanup is a separate action; “review complete” does not automatically authorize removing directories or branches.
