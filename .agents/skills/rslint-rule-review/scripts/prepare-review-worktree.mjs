#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  process.stdout.write(`Usage:
  node prepare-review-worktree.mjs <PR number> [options]

Options:
  --repo <owner/name>       GitHub repository; infer from the local repository by default
  --repo-root <path>        Local Git repository; use the current directory by default
  --remote <name>           Remote used to fetch PR head (default: origin)
  --worktree-root <path>    Parent directory for the new worktree (default: repository parent)
  --apply                   Fetch and create the worktree; preview only by default
  -h, --help                Show this help

If this script fails, read it and manually perform the equivalent workflow in
environment-and-worktrees.md. Inspect any fetch or worktree registration that
may already have completed; do not stop the review.
`);
}

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.stderr.write(
    "Read this script, inspect side effects already produced, and manually reproduce the remaining workflow in references/environment-and-worktrees.md; do not stop the review because a helper script failed.\n",
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    fail(`Cannot run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return options.inherit ? "" : result.stdout.trim();
}

function parseArgs(argv) {
  const options = { remote: "origin", apply: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (["--repo", "--repo-root", "--remote", "--worktree-root"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      options[arg.slice(2).replaceAll("-", "_")] = value;
      index += 1;
    } else if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (options.help) return options;
  if (positional.length !== 1 || !/^[1-9][0-9]*$/.test(positional[0])) {
    usage();
    fail("A valid PR number is required");
  }
  options.pr = positional[0];
  return options;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

const repoInput = path.resolve(options.repo_root || process.cwd());
const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: repoInput });
const remoteNames = run("git", ["remote"], { cwd: repoRoot }).split(/\r?\n/).filter(Boolean);
if (!remoteNames.includes(options.remote)) {
  fail(`Local repository has no remote named ${options.remote}`);
}

const repository = options.repo || JSON.parse(
  run("gh", ["repo", "view", "--json", "nameWithOwner"], { cwd: repoRoot }),
).nameWithOwner;
if (!repository || !repository.includes("/")) fail("Cannot determine the GitHub repository name");

const metadata = JSON.parse(run("gh", [
  "pr",
  "view",
  options.pr,
  "--repo",
  repository,
  "--json",
  "number,author,state,mergedAt,headRefOid,title,url",
]));

if (metadata.state !== "OPEN" || metadata.mergedAt) {
  fail(`PR #${options.pr} is not open`);
}
if (!/^[0-9a-fA-F]{40,64}$/.test(metadata.headRefOid || "")) {
  fail("GitHub returned an invalid head SHA");
}

const worktreeRoot = path.resolve(options.worktree_root || path.dirname(repoRoot));
const repoName = path.basename(repoRoot);
const worktreePath = path.join(
  worktreeRoot,
  `${repoName}-review-pr-${options.pr}-${metadata.headRefOid.slice(0, 8)}`,
);

process.stdout.write([
  `Repository: ${repository}`,
  `PR: #${options.pr} ${metadata.title}`,
  `URL：${metadata.url}`,
  `Author: ${metadata.author?.login || "unknown"}`,
  `Head SHA: ${metadata.headRefOid}`,
  `Local repository: ${repoRoot}`,
  `Remote: ${options.remote}`,
  `Worktree: ${worktreePath}`,
  `Mode: ${options.apply ? "apply" : "preview"}`,
  "",
].join("\n"));

if (existsSync(worktreePath)) fail(`Target path already exists: ${worktreePath}`);
if (!options.apply) {
  process.stdout.write("Preview complete. Check the parameters and target, then add --apply to execute.\n");
  process.exit(0);
}

run("git", ["fetch", "--no-tags", options.remote, `refs/pull/${options.pr}/head`], { cwd: repoRoot });
const fetchedOid = run("git", ["rev-parse", "FETCH_HEAD^{commit}"], { cwd: repoRoot });
if (fetchedOid.toLowerCase() !== metadata.headRefOid.toLowerCase()) {
  fail(`Fetched result does not match GitHub head (fetched=${fetchedOid}, expected=${metadata.headRefOid})`);
}

run("git", ["worktree", "add", "--detach", worktreePath, fetchedOid], { cwd: repoRoot, inherit: true });
const actualOid = run("git", ["rev-parse", "HEAD"], { cwd: worktreePath });
const status = run("git", ["status", "--short"], { cwd: worktreePath });
if (actualOid !== fetchedOid || status !== "") {
  fail("Worktree was created, but final revision or worktree-state validation failed; preserve the state for inspection");
}
process.stdout.write(`Created detached worktree: ${worktreePath} @ ${actualOid}\n`);
