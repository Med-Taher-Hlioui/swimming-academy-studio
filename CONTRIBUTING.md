# Contributing — Swimming Academy Studio

These rules apply to the `slimissa/swimming-academy-studio` fork. Upstream
(`Med-Taher-Hlioui/swimming-academy-studio`) may add its own rules on top.

## The demo contract is non-negotiable

The V0 demo is 100% fictional. Do not weaken this contract. Any change that
touches user input, data handling, auth, or storage must state in the PR
template whether the fictional-data contract changed, and why.

## Workflow

1. Branch from `upstream/main` (not from your fork's `main`, which may lag):
   `git fetch upstream && git checkout -b feat/layer-N-slug upstream/main`
2. Work locally. Run `npm test`, `npm run lint`, `npm run typecheck`,
   `npm run build` before pushing.
3. Push to `origin` (your fork), not `upstream`.
4. Open a **dry-run PR on your fork** (`slimissa:branch → slimissa:main`).
5. Wait for `ci / verify` and, if `src/` or `scripts/` changed, `smoke / browser-smoke` to go green.
6. Only then open the upstream PR (`slimissa:branch → Med-Taher-Hlioui:main`)
   with the CI run link in the description.

**No upstream PR is opened before fork CI is green.** This is the gate.

## Layers

| Layer | Scope | Public fork? |
|---|---|---|
| 0 | CI gate, repo hygiene | yes |
| 1 | Repository contracts, server boundary | yes |
| 2 | Role skeleton (no enforcement) | yes |
| 3 | Storage design + stub adapter | yes |
| 4 | Auth + authorization | **no — private working repo, squash to public before PR** |
| 5 | Durable storage live | **no — same rule** |
| 6 | Cloud provider + hardening | yes |

Layers 4–5 contain schema, auth flows, and RLS policies that must not leak
before review. Work on them in a private clone; reach upstream as a single
squashed commit containing only finished, reviewed code.

## Linear history

`main` requires linear history. Rebase before merge; no merge commits.

## No force-push to `main`

`main` is protected on the fork and upstream. Force-push is disabled.

## Dependency additions

Any new runtime or dev dependency requires a PR that states: the package, the
version range, the license, and whether it runs on the server or client. The
demo currently has zero non-Next/React runtime dependencies. Keep it that way
unless there is a written reason.