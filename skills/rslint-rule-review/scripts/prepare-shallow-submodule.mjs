#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  process.stdout.write(`Usage:
  node prepare-shallow-submodule.mjs --review-worktree <path>
    --submodule <relative-path> [--apply]

Options:
  --review-worktree <path>  Review worktree containing the target gitlink
  --submodule <path>        Submodule path relative to the superproject root
  --apply                   Fetch and check out the exact gitlink commit
  -h, --help                Show this help

The helper initializes an independent shallow checkout inside the review
worktree and fetches only the exact gitlink commit. It never runs an unbounded
submodule clone or modifies another checkout's object database.
`);
}

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.stderr.write(
    "Inspect any partially created target before retrying. Do not overwrite or clean it automatically; choose a fresh review worktree or remove the confirmed partial checkout with explicit authorization.\n",
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
    } else if (["--review-worktree", "--submodule"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      options[arg.slice(2).replaceAll("-", "_")] = value;
      index += 1;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (!options.help && (!options.review_worktree || !options.submodule)) {
    usage();
    fail("review worktree and submodule path must be supplied explicitly");
  }
  return options;
}

function gitmoduleName(repoRoot, gitSubmodulePath) {
  const entries = run("git", [
    "config",
    "--file",
    ".gitmodules",
    "--get-regexp",
    "^submodule\\..*\\.path$",
  ], { cwd: repoRoot }).split(/\r?\n/);
  for (const entry of entries) {
    const match = entry.match(/^submodule\.(.+)\.path\s+(.+)$/);
    if (match && match[2] === gitSubmodulePath) return match[1];
  }
  fail(`Cannot find ${gitSubmodulePath} in .gitmodules`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

const reviewInput = path.resolve(options.review_worktree);
const reviewRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: reviewInput });
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

const superStatus = run("git", ["status", "--short", "--ignore-submodules=all"], { cwd: reviewRoot });
if (superStatus !== "") fail("Review worktree already has non-submodule changes");
const treeEntry = run("git", ["ls-tree", "HEAD", "--", gitSubmodulePath], { cwd: reviewRoot });
const treeMatch = treeEntry.match(/^160000 commit ([0-9a-fA-F]{40,64})\t/);
if (!treeMatch) fail(`Target is not a submodule gitlink: ${gitSubmodulePath}`);
const expectedOid = treeMatch[1].toLowerCase();
const moduleName = gitmoduleName(reviewRoot, gitSubmodulePath);
const submoduleUrl = run("git", ["config", "--file", ".gitmodules", "--get", `submodule.${moduleName}.url`], { cwd: reviewRoot });
if (!submoduleUrl) fail(`Submodule ${moduleName} has no URL`);
if (/^(?:\.\.?[/\\])/.test(submoduleUrl)) {
  fail(`Relative submodule URLs are not supported by this helper: ${submoduleUrl}`);
}

if (existsSync(target) && readdirSync(target).length !== 0) {
  const gitMarker = path.join(target, ".git");
  if (existsSync(gitMarker)) {
    const actualOid = run("git", ["rev-parse", "HEAD"], { cwd: target }).toLowerCase();
    const targetStatus = run("git", ["status", "--short"], { cwd: target });
    const shallow = run("git", ["rev-parse", "--is-shallow-repository"], { cwd: target });
    if (actualOid === expectedOid && targetStatus === "" && shallow === "true") {
      process.stdout.write(`Already aligned shallow checkout: ${target} @ ${actualOid}\n`);
      process.exit(0);
    }
  }
  fail(`Target path already exists and is not an aligned clean shallow checkout: ${target}`);
}

process.stdout.write([
  `Review worktree: ${reviewRoot}`,
  `Submodule: ${gitSubmodulePath}`,
  `URL: ${submoduleUrl}`,
  `Target commit: ${expectedOid}`,
  `Target path: ${target}`,
  `Mode: ${options.apply ? "apply" : "preview"}`,
  "",
].join("\n"));
if (!options.apply) {
  process.stdout.write("Preview complete. Check the target, URL, and commit, then add --apply.\n");
  process.exit(0);
}

if (!existsSync(target)) mkdirSync(target, { recursive: false });
run("git", ["init"], { cwd: target, inherit: true });
run("git", ["remote", "add", "origin", submoduleUrl], { cwd: target });
run("git", ["fetch", "--depth=1", "--no-tags", "origin", expectedOid], { cwd: target, inherit: true });
const fetchedOid = run("git", ["rev-parse", "FETCH_HEAD^{commit}"], { cwd: target }).toLowerCase();
if (fetchedOid !== expectedOid) fail(`Fetched ${fetchedOid}, expected ${expectedOid}`);
run("git", ["checkout", "--detach", expectedOid], { cwd: target, inherit: true });
const actualOid = run("git", ["rev-parse", "HEAD"], { cwd: target }).toLowerCase();
const targetStatus = run("git", ["status", "--short"], { cwd: target });
const shallow = run("git", ["rev-parse", "--is-shallow-repository"], { cwd: target });
const finalSuperStatus = run("git", ["status", "--short"], { cwd: reviewRoot });
if (actualOid !== expectedOid || targetStatus !== "" || shallow !== "true" || finalSuperStatus !== "") {
  fail("Shallow checkout was created, but final SHA, shallowness, or cleanliness validation failed");
}
process.stdout.write(`Created shallow submodule checkout: ${target} @ ${actualOid}\n`);
