# ClearGov — Development Process

## Branching Strategy
- **`main`** is the stable branch. All code on `main` should be production-ready.
- Each milestone gets its own feature branch: `feature/m0-scaffolding`, `feature/m1-auth`, etc.
- Sub-branches off a milestone branch are allowed for large milestones (e.g., `feature/m5-worksheet/virtualization`).
- Branches are merged via PR only — no direct pushes to `main`.

## Commit Conventions
All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use |
|--------|-----|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `chore:` | Maintenance, dependency updates, config changes |
| `test:` | Adding or updating tests |
| `docs:` | Documentation changes |
| `refactor:` | Code restructuring without behavior change |
| `ci:` | CI/CD pipeline changes |
| `style:` | Formatting, whitespace (no logic changes) |
| `perf:` | Performance improvements |

Scope is optional but encouraged: `feat(api): add health check endpoint`

## Testing
- **Framework:** Vitest for unit and integration tests; Playwright for E2E (added later).
- **Write tests alongside code** — every major piece of work includes tests.
- Tests live next to the code they test (e.g., `src/utils/calculate.ts` → `src/utils/calculate.test.ts`).
- **New routers and services must include a colocated `.test.ts` file** covering at minimum:
  - Auth/admin guard tests (unauthenticated → UNAUTHORIZED, non-admin → FORBIDDEN)
  - Input validation for critical edge cases
  - At least one happy-path test per procedure
- **New validation schemas** must include tests for valid input, invalid input, and default values.
- All tests must pass before opening a PR.
- Target meaningful coverage — test business logic, edge cases, and integration points. Don't chase 100% coverage on boilerplate.
- **API test helpers:** Use `createTestCaller()` from `apps/api/src/test-utils/` to test tRPC routers with a mock DB context.

## Pull Request Workflow
1. Push feature branch to remote.
2. Open PR targeting `main` (or parent milestone branch).
3. PR description includes:
   - Summary of changes
   - Link to relevant milestone PRD
4. **PR Checklist** (must all be checked before merge):
   - [ ] `turbo test` — all tests pass
   - [ ] `turbo lint` — zero warnings
   - [ ] `turbo build` — zero type errors
   - [ ] Acceptance criteria from milestone PRD addressed
   - [ ] No secrets or `.env` files committed
5. Merge after approval.

## Code Quality
- TypeScript strict mode, no `any` types.
- ESLint with shared config — zero warnings policy.
- Prettier for consistent formatting.
- All packages use ESM (`"type": "module"`).
