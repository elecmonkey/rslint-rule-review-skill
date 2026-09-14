#!/usr/bin/env node

import { existsSync, readdirSync, rmdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  process.stdout.write(`Usage:
  node reuse-submodule-worktree.mjs --review-worktree <path>
    --source-checkout <path> --submodule <relative-path> [--apply]

Options:
  --review-worktree <path>  Review worktree containing the target gitlink
  --source-checkout <path>  Initialized submodule checkout that has the target commit
  --submodule <path>        Submodule path relative to the superproject root
  --apply                   Create detached submodule worktree; preview only by default
  -h, --help                Show this help

If this script fails, read it and manually perform the equivalent workflow in
environment-and-worktrees.md. When object reuse is unavailable, shallow-fetch
only the exact gitlink commit at depth 1; do not stop the review.
`);
}

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.stderr.write(
    "Read this script, inspect side effects already produced, and manually reproduce the equivalent workflow in references/environment-and-worktrees.md. When object reuse is unavailable, shallow-fetch only the exact gitlink commit at depth 1; do not stop the review.\n",
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  if (result.error) fail(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return options.inherit ? "" : result.stdout.trim();
}

function parseArgs(argv) {
  const options = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (["--review-worktree", "--source-checkout", "--submodule"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      options[arg.slice(2).replaceAll("-", "_")] = value;
      index += 1;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (!options.help && (!options.review_worktree || !options.source_checkout || !options.submodule)) {
    usage();
    fail("review worktree, source checkout, and submodule path must be supplied explicitly");
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

const reviewInput = path.resolve(options.review_worktree);
const reviewRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: reviewInput });
const sourceCheckout = path.resolve(options.source_checkout);
run("git", ["rev-parse", "--show-toplevel"], { cwd: sourceCheckout });

if (path.isAbsolute(options.submodule)) fail("--submodule must be a relative path");
const normalizedSubmodule = path.normalize(options.submodule);
if (normalizedSubmodule === ".." || normalizedSubmodule.startsWith(`..${path.sep}`)) {
  fail("Submodule path cannot leave the review worktree");
}
const target = path.resolve(reviewRoot, normalizedSubmodule);
const relativeTarget = path.relative(reviewRoot, target);
if (!relativeTarget || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
  fail("Submodule path must point to a child directory inside the review worktree");
}
const gitSubmodulePath = relativeTarget.split(path.sep).join("/");

const superStatus = run("git", ["status", "--short"], { cwd: reviewRoot });
if (superStatus !== "") fail("Review worktree already has changes; preserve and handle them first");

const treeEntry = run("git", ["ls-tree", "HEAD", "--", gitSubmodulePath], { cwd: reviewRoot });
const match = treeEntry.match(/^160000 commit ([0-9a-fA-F]{40,64})\t/);
if (!match) fail(`Target is not a submodule gitlink in the current revision: ${gitSubmodulePath}`);
const expectedOid = match[1];

run("git", ["cat-file", "-e", `${expectedOid}^{commit}`], { cwd: sourceCheckout });

const targetGit = path.join(target, ".git");
if (existsSync(targetGit)) {
  const actualOid = run("git", ["rev-parse", "HEAD"], { cwd: target });
  const targetStatus = run("git", ["status", "--short"], { cwd: target });
  if (actualOid !== expectedOid || targetStatus !== "") {
    fail(`Existing submodule checkout is misaligned or modified: ${target}`);
  }
  process.stdout.write(`Already aligned: ${target} @ ${actualOid}\n`);
  process.exit(0);
}

if (existsSync(target) && readdirSync(target).length !== 0) {
  fail(`Target path already exists and is non-empty: ${target}`);
}

process.stdout.write([
  `Review worktree: ${reviewRoot}`,
  `Source checkout: ${sourceCheckout}`,
  `Submodule: ${gitSubmodulePath}`,
  `Target commit: ${expectedOid}`,
  `Target path: ${target}`,
  `Mode: ${options.apply ? "apply" : "preview"}`,
  "",
].join("\n"));

if (!options.apply) {
  process.stdout.write("Preview complete. Check the parameters and target, then add --apply to execute.\n");
  process.exit(0);
}

if (existsSync(target)) rmdirSync(target);
run("git", ["worktree", "add", "--detach", target, expectedOid], { cwd: sourceCheckout, inherit: true });
const actualOid = run("git", ["rev-parse", "HEAD"], { cwd: target });
const targetStatus = run("git", ["status", "--short"], { cwd: target });
const finalSuperStatus = run("git", ["status", "--short"], { cwd: reviewRoot });
if (actualOid !== expectedOid || targetStatus !== "" || finalSuperStatus !== "") {
  fail("Submodule worktree was created, but final-state validation failed; preserve the state for inspection");
}
process.stdout.write(`Reused submodule worktree: ${target} @ ${actualOid}\n`);
