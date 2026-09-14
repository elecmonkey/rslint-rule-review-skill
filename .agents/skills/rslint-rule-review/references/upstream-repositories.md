# Upstream Repositories for Rslint Built-in Rules

Rstest rules are excluded.

| Rslint rule set | Upstream repository |
|---|---|
| ESLint Core | https://github.com/eslint/eslint |
| TypeScript ESLint | https://github.com/typescript-eslint/typescript-eslint |
| Import | https://github.com/import-js/eslint-plugin-import |
| Jest | https://github.com/jest-community/eslint-plugin-jest |
| JSX A11y | https://github.com/jsx-eslint/eslint-plugin-jsx-a11y |
| Node | https://github.com/eslint-community/eslint-plugin-n |
| Promise | https://github.com/eslint-community/eslint-plugin-promise |
| React | https://github.com/jsx-eslint/eslint-plugin-react |
| React Hooks | https://github.com/facebook/react |
| Unicorn | https://github.com/sindresorhus/eslint-plugin-unicorn |

## Version Requirement

Identify the upstream release version that the reviewed rule explicitly aligns with and read that release tag. The implementation, tests, documentation, and shared helpers must all come from the same tag.

Do not use upstream `origin/main`, `main`, `master`, a default branch, HEAD, or current website source as a substitute for the target release tag. Even if newer code appears more complete, use it only as supplemental context and never as the parity baseline.

If the PR, rule documentation, or tests state a concrete version, use that version's tag. If they conflict or do not establish one deterministically, report version ambiguity as a review blocker instead of choosing the newest version.
