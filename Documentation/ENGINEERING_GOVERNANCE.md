# Engineering Governance

This document captures the compatibility-first architecture rules for the production ERP frontend.

## Runtime Safety

- Do not change route structure without compatibility wrappers.
- Do not change API payload contracts without adapter support.
- Do not change financial calculation behavior during performance work.
- Keep Supabase auth, RBAC, and workflow sequencing stable.

## Query Ownership

- Feature hooks own query URLs, stale times, transforms, and refresh strategy.
- Shared query helpers under `src/shared/query` own policy defaults and invalidation primitives.
- Prefer targeted invalidation helpers over direct broad cache clearing.
- If a screen already performs an explicit refresh, prefer invalidation with `refetchType: "none"` to avoid duplicate fetch bursts.

## Mutation Ownership

- Feature mutation hooks own request lifecycle, cache sync, and rollback strategy.
- Do not scatter raw invalidation chains through page components when a feature hook exists.
- Avoid optimistic updates for finance, approvals, exports, or destructive workflows.

## Performance Boundaries

- Expensive derivations belong in feature selectors or memoized hooks, not inline render paths.
- Heavy preview, export, and analytics surfaces should stay isolated from editor state.
- Virtualization is allowed only for low-risk, static-height, non-financial, non-editable feeds.
- Keep prefetching opportunistic and visibility-aware.

## Tooling

- `npm run lint` is the baseline static check for the web app.
- `npm run build` validates production compatibility.
- `npm run check` runs lint plus build.
- `npm run perf:baseline` prints a lightweight post-build asset summary from `.next/build-manifest.json`.

## Flat Config Notes

- ESLint 9 uses `eslint.config.mjs`.
- The current config intentionally keeps Next.js and core correctness rules active.
- Some React compiler-oriented rules are softened for compatibility with the existing Pages Router codebase and should only be re-enabled alongside focused refactors.
