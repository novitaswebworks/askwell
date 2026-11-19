# Dependency refresh — 16 November 2026

[Certain] Updated 20 distinct direct packages across the workspace, refreshed the lockfile, and resolved the remaining known dependency advisory. Full page rendering has a local runtime blocker that also reproduces with the exact original dependency lockfile.

## Versions

| Package | Previously installed | Updated version |
|---|---|---|
| `@ai-sdk/openai-compatible` | 3.0.82 | 3.0.92 |
| `@next/env` | 16.4.3 | 16.4.6 |
| `@tailwindcss/turbopack` | 4.3.3 | 4.3.5 |
| `ai` | 7.0.159 | 7.0.173 |
| `eslint-config-next` | 16.4.3 | 16.4.6 |
| `next` | 16.4.3 | 16.4.6 |
| `react` | 19.3.0 | 19.3.1 |
| `react-dom` | 19.3.0 | 19.3.1 |
| `tailwindcss` | 4.3.3 | 4.3.5 |
| `@clerk/nextjs` | 7.9.23 | 7.10.0 |
| `@supabase/supabase-js` | 2.118.0 | 2.119.0 |
| `posthog-js` | 1.444.0 | 1.450.0 |
| `posthog-node` | 5.61.1 | 5.74.0 |
| `unpdf` | 2.1.0 | 2.2.1 |
| `@types/node` | 20.19.43 | 22.20.5 |
| `eslint` | 9.39.5 | 9.39.5 |
| `typescript` | 5.9.3 | 6.0.3 |
| `vitest` | 3.2.7 | 5.1.0 |
| `@electric-sql/pglite` | 0.5.13 | 0.5.16 |
| `@electric-sql/pglite-pgvector` | 0.0.14 | 0.0.17 |
| `esbuild` | 0.25.12 | 0.28.2 |

## Compatibility choices

- Retained ESLint 9.39.5: plugins used by eslint-config-next declare support through ESLint 9. Installation reports that ESLint 9 itself is deprecated; migration to 10 requires a compatible lint-plugin stack.
- Upgraded TypeScript to 6.0.3 rather than 7.0.2: typescript-eslint declares TypeScript <6.1, and the framework uses the programmatic TypeScript API.
- Upgraded Node types to the latest Node 22 release, 22.20.5, to match the minimum supported runtime line instead of exposing Node 26-only APIs to the application.
- Vitest 5 requires newer Node versions. Root engines now match supported runtime ranges: ^22.12.0 || ^24.0.0 || >=26.0.0. README prerequisites and TypeScript badge updated. Validation ran with Node 26.13.0 and pnpm 11.24.0.
- Added a narrow override for @typescript-eslint/typescript-estree's minimatch dependency to 11.0.1 for GHSA-g3hv-75wg-m249. Final pnpm audit reports zero known vulnerabilities. Remove the override once upstream adopts the patched major.
- Retained the existing pnpm 11.24.0 package-manager pin; no global package-manager installation was changed.

## Verification

- Frozen-lockfile install: passed.
- Full tests: 589 passed (501 web, 41 database, 30 shared, 17 widget).
- Workspace typecheck: passed.
- Workspace lint: passed with 19 warnings and no errors. Warnings concern an internal window.location navigation, unused test parameters, and generated widget code.
- Widget and Next.js production build: passed.
- Audit: zero known vulnerabilities.
- Registry recheck: remaining newer majors are ESLint 10, TypeScript 7 and Node 26 types, intentionally retained on compatible lines as explained above.

## Runtime result

Both production and development servers start. Static widget.js and favicon.ico return HTTP 200. Homepage, sign-in and robots requests through the authentication proxy stall without returning headers within the sampled 10–30 second deadlines.

To distinguish a dependency regression from a baseline issue, temporarily restored all original package manifests, pnpm-workspace.yaml and pnpm-lock.yaml from HEAD, installed with --frozen-lockfile, and launched the original application. Its homepage also timed out after 12 seconds with no response. Restored and reinstalled all updated dependency files afterwards.

The configured Clerk client independently completed anonymous authentication in 7 ms, and the configured Clerk frontend was reachable. [Likely] The stall is in the local Next.js/Clerk proxy integration, but its exact cause remains unverified. Authentication was not bypassed. No completed browser rendering, signed-in workflow, live AI conversation or payment flow is claimed.

Development server is launched at http://127.0.0.1:3000 using pnpm dev --hostname 127.0.0.1. Its listener being ready does not establish that the full application is usable.

## References

- Vitest migration: https://vitest.dev/guide/migration/
- ESLint migration: https://eslint.org/docs/latest/use/migrate-to-10.0.0
- TypeScript 7 release: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- minimatch advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249

No application source, credentials or authentication controls were changed. Pre-existing untracked files were left in place.
