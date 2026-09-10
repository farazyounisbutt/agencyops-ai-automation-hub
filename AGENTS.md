# AgencyOps project instructions

## Purpose and structure

AgencyOps is an AI-powered automation and reporting hub for digital agencies.
The current foundation supports workspaces, users, memberships, and clients.

- `apps/api`: NestJS API, Prisma schema/migrations/seed, and API tests.
- `apps/web`: Next.js App Router frontend; currently the starter scaffold.
- `packages/*`: reserved for shared workspace packages; none implemented yet.
- `docs`: project status, product scope, and MVP roadmap.
- Root `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and `compose.yaml`: workspace,
  dependency lockfile, and local infrastructure.

Read applicable nested instructions, including `apps/web/AGENTS.md`, before
editing those areas.

## MVP architecture boundaries

Follow [product scope](docs/PRODUCT_SCOPE.md) and [roadmap](docs/ROADMAP.md).
NestJS owns business rules, authentication, authorization, persistence, and
audit records. PostgreSQL is the system of record. Next.js provides the
agency-facing dashboard. n8n is part of the planned MVP and orchestrates manual
and scheduled automation workflows and external integrations; it must not
become the primary application backend or directly own core business data.
Redis supports queues, background processing, caching, and retries.

n8n is not yet installed or configured in this repository. Its callbacks must
go through NestJS for validation and persistence. Human approval is required
before report email delivery. Fixture data is only a development and testing
mechanism. One live marketing-data connector is required for MVP completion.
Integrations beyond that one live connector are outside the MVP.

## Stack and version constraints

Preserve the existing versions and lockfile unless dependency changes are part
of the task. Major-version ranges below are from the committed manifests;
exact pins are identified explicitly.

| Area | Current version constraints |
| --- | --- |
| Package manager | pnpm 12, exactly `12.3.4` |
| API | NestJS 12, TypeScript 6, Node ESM (`nodenext`) |
| Database access | Prisma CLI/client/pg adapter exactly `7.9.1`; `pg` 8 |
| Web | Next.js exactly `16.3.4`; React/React DOM exactly `19.2.8` |
| Web tooling | TypeScript 5, Tailwind CSS 4, ESLint 9 |
| API tooling | Vitest 4, Oxlint 1, Prettier 3, tsx 4 |
| Infrastructure | PostgreSQL `17-alpine`, Redis `7-alpine` |

The Node.js runtime version is not pinned in the repository. Do not infer a
runtime pin from `@types/node` (API 24, web 20).

## ESM and Prisma conventions

- Use explicit `.js` extensions in relative TypeScript module imports that
  execute as Node ESM, including API source, tests, and seed code. For example:
  `import { AppModule } from './app.module.js';`. Bare package imports remain
  unchanged. Preserve Next.js bundler and alias conventions in the frontend.
- Edit `apps/api/prisma/schema.prisma` for model changes. Create and commit a
  named migration under `apps/api/prisma/migrations`; do not rewrite applied
  migrations or use `db push` as a substitute for migration history.
- Run Prisma commands from the API package using `pnpm --dir apps/api exec
  prisma ...`. Configuration lives in `apps/api/prisma.config.ts` and reads
  `DATABASE_URL` from the environment/API-local `.env`.
- Create development migrations with `prisma migrate dev --name <name>`; apply
  committed migrations with `prisma migrate deploy`.
- Run `prisma generate` explicitly after schema changes and before a fresh
  API build/test. The generated client lives in
  `apps/api/src/generated/prisma` and is ignored; never edit or commit it.
- Prisma uses `@prisma/adapter-pg`. Keep CLI, client, and adapter versions aligned.
- Run demo seeding explicitly with `prisma db seed`, after migrations and
  generation. Preserve its transactional, repeatable upsert behavior.

## Local development

- Use pnpm from the repository root to install workspace dependencies:
  `pnpm install --frozen-lockfile`.
- Create local root `.env` and `apps/api/.env` from `.env.example` only if missing;
  set consistent local database credentials. Never overwrite an existing
  environment file without inspecting the intended change privately.
- Root `.env` configures Docker Compose. The API loads `.env` then `../../.env`;
  Prisma CLI configuration loads `.env` in its API working directory.
- Start infrastructure with `docker compose up -d` and inspect it with
  `docker compose ps`. PostgreSQL uses port 5432 and Redis uses 6379, with named
  persistent volumes and health checks. Redis is provisioned but not yet wired
  into application code.
- Start API with `pnpm --dir apps/api start:dev` (default port 3001) and web with
  `pnpm --dir apps/web dev` (default port 3000), in separate terminals.
- API routes use `/api`; CORS defaults to `http://localhost:3000` via `WEB_URL`.
- `docker compose down` stops local services. Do not remove volumes or reset
  databases without explicit authorization to discard their data.

## Workflow and verification

Before implementing any application task, read `docs/PRODUCT_SCOPE.md`,
`docs/ROADMAP.md`, and `docs/PROJECT_STATUS.md` and present a task brief containing:

- Business outcome
- User-visible behavior
- How the task contributes to the MVP workflow
- Included scope
- Explicit non-goals
- Acceptance criteria
- Expected files/components
- Required tests
- Proposed branch name
- Proposed commit message

Wait for user approval before modifying files for that application task.

- Start from clean, up-to-date `main`; work on a feature or chore branch.
- Keep one focused task per branch. Avoid unrelated application or dependency
  changes, and preserve other people's work.
- Update `docs/PROJECT_STATUS.md` when a completed task materially changes the
  documented project status. Keep that update focused on the completed task.
- Use Conventional Commits, such as `feat(api): add client read endpoints` or
  `docs: document project context`.
- For application changes, required checks are both builds, both linters, API
  unit tests, and API end-to-end tests:

  ```sh
  pnpm --dir apps/api build
  pnpm --dir apps/web build
  pnpm --dir apps/api lint
  pnpm --dir apps/web lint
  pnpm --dir apps/api test
  pnpm --dir apps/api test:e2e
  ```

- API end-to-end tests require a configured, reachable PostgreSQL database and
  generated Prisma client. For database changes also validate the schema, apply
  migrations to a development database, and verify relevant seed behavior.
- For documentation-only changes, verify commands and claims against source,
  inspect the full diff, and run whitespace checks; builds/tests are optional.
  Report checks actually run, failures, and any skipped checks accurately.
- Never commit secrets, real credentials, or generated environment files.
  Only sanitized `.env.example` templates belong in version control.
- Show the user the diff and verification results before committing. Wait for
  approval to commit when the task requests review first.
- Do not push or merge without the user's approval.
