# AgencyOps project status

Repository baseline: `a63a216` on `main`, inspected on 2026-09-10.

## Product goal

Build an AI-powered automation and reporting hub for digital agencies, with
workspace-based client management as the foundation. Automation, integrations,
and reporting are future product work, not implemented capabilities. Build and
validate a deterministic fixture-backed workflow with n8n first, then add
AI-assisted drafts, human review and approval, and approved email delivery.
Add one live marketing-data connector, separate from the fixture provider,
before final MVP completion. Add scheduling only after manual execution works.
See [Product scope](PRODUCT_SCOPE.md) for architecture responsibilities and the
complete workflow, and [Roadmap](ROADMAP.md) for the 14 implementation phases.

## Completed foundation

Recent Git history, oldest first:

- `38cc0d9`: pnpm monorepo with NestJS API and Next.js frontend scaffolds.
- `a25b371`: Docker PostgreSQL/Redis, Prisma configuration, initial core migration,
  global configuration, and database connection lifecycle.
- `f8e9c8f`: database health endpoint, `/api` prefix, and frontend CORS origin.
- `2ca9e7d` (PR #1): repeatable transactional demo seed.
- `a63a216` (PR #2): workspace-scoped client list/detail endpoints and service tests.

The frontend still displays the Next.js starter page. Redis has local Docker
infrastructure but no application integration. Authentication, membership
authorization, client update/archive, automation, and reporting are not implemented.
n8n is planned for the MVP but has no Docker service or local configuration yet.

Client Creation API is implemented and verified:
workspace-scoped insertion, declarative DTO validation, and shared bootstrap/e2e
configuration for the `/api` prefix, CORS, and global `ValidationPipe`.

## Database models

Schema: `apps/api/prisma/schema.prisma`. Initial migration:
`20260908224541_init_core`.

| Model | Existing fields and relationships |
| --- | --- |
| `Workspace` | UUID id, name, unique slug, timestamps; has members and clients |
| `User` | UUID id, unique email, optional name, timestamps; has memberships |
| `WorkspaceMember` | Composite workspace/user primary key, role, joinedAt; foreign keys cascade on deletion; userId index |
| `Client` | UUID id, workspaceId, name, slug, optional website, timezone (UTC default), status, timestamps; unique workspaceId/slug and workspaceId index; workspace deletion cascades |

`WorkspaceRole`: OWNER, ADMIN, ANALYST (default), REVIEWER.
`ClientStatus`: ACTIVE (default), INACTIVE, ARCHIVED.

## Existing API endpoints

Default base URL: `http://localhost:3001/api`.

| Method and path | Behavior |
| --- | --- |
| `GET /api` | Returns `Hello World!` |
| `GET /api/health` | Executes `SELECT 1`; returns status, database state, and timestamp; database query failure returns 503 |
| `GET /api/workspaces/:workspaceSlug/clients` | Returns all workspace clients ordered by name ascending; empty array if none; 404 for missing workspace |
| `GET /api/workspaces/:workspaceSlug/clients/:clientId` | Returns client scoped to workspace; 404 for missing workspace, missing/out-of-workspace client, or invalid UUID |
| `POST /api/workspaces/:workspaceSlug/clients` | Creates a client with 201; invalid input returns 400, missing workspace 404, and duplicate workspace/client slug 409; the same slug is allowed in another workspace |

Creation requires a trimmed name (1–200 characters) and an unmodified lowercase
alphanumeric slug with single hyphen separators (1–100 characters). Optional
`website` accepts an HTTP/HTTPS URL or null; optional `timezone` accepts a named
IANA time zone and rejects null. Omission uses the database defaults: UTC and
ACTIVE status. Unknown properties, including `workspaceId` and `status`, are
rejected. Workspace ownership comes only from the route's workspace lookup.
Runtime validation dependencies are pinned to `class-validator` 0.15.1 and
`class-transformer` 0.5.1. The Prisma schema and migrations are unchanged.

Client routes currently have no authentication or membership authorization.
The health endpoint checks PostgreSQL only. Database connection failure can
also prevent API startup because Prisma connects during module initialization.

## Seed-data capability

`apps/api/prisma/seed.ts`, registered in `prisma.config.ts`, uses a transaction
and upserts to create:

- Workspace `agencyops-demo` (AgencyOps Demo).
- User `owner@agencyops.example` (Demo Owner) with an OWNER membership.
- Clients `acme-studio` (Acme Studio) and `northstar-labs` (Northstar Labs).

Repeated runs avoid duplicates and preserve existing workspace/user/client
fields; the demo membership role is set to OWNER. Seeding requires
`DATABASE_URL`, applied migrations, and a generated client. It creates no login
credentials and does not implement authentication.

## Start and verify

Run from the repository root. Use pnpm `12.3.4`, Docker Compose, and a Node.js
runtime compatible with the installed packages; no runtime version is pinned.

Create root `.env` and `apps/api/.env` from `.env.example` if absent, replacing
placeholder credentials consistently. Root `.env` supplies Compose variables;
API-local `.env` supplies Prisma CLI configuration. Do not commit either file.

```sh
pnpm install --frozen-lockfile
docker compose up -d
docker compose ps
pnpm --dir apps/api exec prisma validate
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec prisma generate
pnpm --dir apps/api exec prisma db seed
```

Start each application in its own terminal:

```sh
pnpm --dir apps/api start:dev
pnpm --dir apps/web dev
```

Web: `http://localhost:3000`. API: port 3001 by default (`PORT` override).
`WEB_URL` controls the allowed CORS origin. PostgreSQL and Redis expose local
ports 5432 and 6379 and persist data in named Docker volumes.

Verification commands:

```sh
pnpm --dir apps/api build
pnpm --dir apps/web build
pnpm --dir apps/api lint
pnpm --dir apps/web lint
pnpm --dir apps/api test
pnpm --dir apps/api test:e2e
curl --fail http://localhost:3001/api/health
curl --fail http://localhost:3001/api/workspaces/agencyops-demo/clients
```

API unit tests cover the scaffold controller, client read/create service behavior
with mocked database access, and DTO validation through the configured pipe.
End-to-end tests use PostgreSQL and the same `configureApp` function as bootstrap.
They check `/api`, client creation, validation, scoped reads, and duplicate-slug
behavior including concurrent requests. The new suite creates UUID-named test
workspaces and deletes only its own recorded workspace IDs and cascading clients.
Health HTTP coverage remains pending. The web package has no test script.
The curl checks require the running API, and the demo request requires seeding.

Client creation verification (2026-09-11):

- API build passed.
- Web build passed in the normal local terminal (confirmed by the user).
- API lint passed.
- Web lint passed.
- 67 unit tests passed.
- 8 PostgreSQL-backed end-to-end tests passed.
- `git diff --check` passed.

`pnpm peers check` continues to report a pre-existing mismatch: `tsconfck` 3.1.6
expects TypeScript ^5 while the API currently uses TypeScript 6.0.3. This mismatch
was not introduced or changed by this feature.

For new schema work, use
`pnpm --dir apps/api exec prisma migrate dev --name <name>` and explicitly
regenerate the client. Stop infrastructure with `docker compose down`; retain
volumes unless intentionally discarding local data.

## Immediate next task and MVP roadmap

**Client Creation API is implemented and verified.** The immediate next planned
task is **Client Update API**, requiring a separate task brief, approval, feature
branch, and commit. Client archive remains a later separate task within the
Client Write API roadmap phase.
Authentication and workspace authorization follow before exposing client
management to real users.

The [MVP roadmap](ROADMAP.md) records 14 implementation phases, from client writes
through n8n reporting, review, delivery, the live connector, monitoring, and
CI/deployment preparation.
The [product scope](PRODUCT_SCOPE.md) defines ownership boundaries and excludes
integrations beyond one live marketing-data connector, separate from the fixture
provider. These describe
planned work; the completed foundation above remains the implementation baseline.
