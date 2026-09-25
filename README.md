# AgencyOps AI Automation Hub

AgencyOps is an AI-powered automation and reporting hub for small and medium
digital agencies.

The MVP aims to help agency teams manage clients, run automated performance
reporting workflows, review AI-assisted reports, approve them, and deliver them
to clients with a visible execution history.

> AgencyOps is under active development and is not yet production-ready.

## Current status

The project currently includes:

- A pnpm monorepo with NestJS and Next.js applications
- PostgreSQL and Redis development infrastructure through Docker Compose
- Prisma database models and migrations
- Repeatable demo-data seeding
- Workspace-scoped client listing and detail endpoints
- Client creation, partial update, and archive endpoints
- Clerk Invite-only authentication
- Local Clerk-to-AgencyOps user identity mapping
- Protected `GET /api/me`
- Operator-controlled user provisioning
- Automated unit and PostgreSQL-backed end-to-end tests

Workspace authorization is the next application phase. Existing client
endpoints are temporarily public until membership and role enforcement is
implemented.

See [Project Status](docs/PROJECT_STATUS.md) for the detailed implementation
status.

## MVP workflow

The target reporting workflow is:

1. An authorized agency user manages a client.
2. The user manually triggers a reporting workflow.
3. NestJS creates and tracks an automation run.
4. n8n retrieves normalized performance data.
5. AgencyOps generates an AI-assisted report draft.
6. A human reviews and edits the draft.
7. An authorized reviewer approves or rejects it.
8. Approved reports are delivered by email.
9. The dashboard displays execution, review, retry, and delivery history.
10. Scheduled reporting is added after the manual workflow is validated.

See [Product Scope](docs/PRODUCT_SCOPE.md) and
[MVP Roadmap](docs/ROADMAP.md) for the complete scope and implementation order.

## Architecture

| Component | Responsibility |
| --- | --- |
| Next.js | Agency-facing web application and Clerk sign-in experience |
| NestJS | Business rules, API contracts, authentication verification, authorization, and persistence |
| PostgreSQL | System of record for users, workspaces, memberships, clients, reports, and execution history |
| Prisma | Database schema, migrations, generated client, and seed operations |
| Clerk | Managed identity, sign-in, sessions, and signed authentication tokens |
| Redis | Planned background jobs, caching, retries, and queue support |
| n8n | Planned workflow orchestration and external integrations |

Clerk owns authentication, while AgencyOps owns users, workspaces, memberships,
roles, and authorization decisions.

n8n will orchestrate workflows but will not become the primary application
backend or directly own core AgencyOps business data.

## Repository structure

```text
agencyops-ai-automation-hub/
├── apps/
│   ├── api/              NestJS API, Prisma schema, migrations, and tests
│   └── web/              Next.js web application
├── automation/           Planned workflow and automation assets
├── docs/                 Product scope, roadmap, status, and setup guides
├── fixtures/             Planned repeatable integration and reporting fixtures
├── packages/             Reserved for shared workspace packages
├── compose.yaml          Local PostgreSQL and Redis services
├── package.json          Root workspace configuration
├── pnpm-lock.yaml        Root dependency lockfile
└── pnpm-workspace.yaml   pnpm workspace definition
```

## Technology stack

- Node.js 24 recommended for local development
- pnpm `12.3.4`
- NestJS 12
- Next.js `16.3.4`
- React `19.2.8`
- TypeScript
- Prisma `7.9.1`
- PostgreSQL 17
- Redis 7
- Clerk
- Vitest
- Docker Compose

The repository does not currently pin the Node.js runtime. Node.js 24 is the
tested local development version.

## Prerequisites

Install:

- Node.js 24
- pnpm `12.3.4`
- Git
- Docker Desktop with Docker Compose

Confirm the tools:

```bash
node --version
pnpm --version
git --version
docker --version
docker compose version
```

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/farazyounisbutt/agencyops-ai-automation-hub.git
cd agencyops-ai-automation-hub
```

### 2. Install dependencies

```bash
pnpm install --frozen-lockfile
```

The repository must contain only the root `pnpm-lock.yaml`.

### 3. Create local environment files

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Replace placeholder values locally. Never commit real credentials or local
environment files.

Clerk must be configured before running the authenticated application. Follow
the [Clerk Authentication Setup](docs/CLERK_AUTHENTICATION.md).

### 4. Start PostgreSQL and Redis

```bash
docker compose up -d
docker compose ps
```

Both services should report a healthy status.

### 5. Prepare the database

```bash
pnpm --dir apps/api exec prisma validate
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec prisma generate
pnpm --dir apps/api exec prisma db seed
```

The seed is repeatable and creates the AgencyOps demo workspace, owner,
membership, and example clients.

### 6. Start the API

Run in one terminal:

```bash
pnpm --dir apps/api start:dev
```

The API runs at:

```text
http://localhost:3001/api
```

### 7. Start the web application

Run in another terminal:

```bash
pnpm --dir apps/web dev
```

The web application runs at:

```text
http://localhost:3000
```

## Existing API capabilities

| Method and route | Authentication | Purpose |
| --- | --- | --- |
| `GET /api` | Public | Basic API response |
| `GET /api/health` | Public | PostgreSQL health check |
| `GET /api/me` | Required | Return the linked local AgencyOps user |
| `GET /api/workspaces/:workspaceSlug/clients` | Temporarily public | List workspace clients |
| `GET /api/workspaces/:workspaceSlug/clients/:clientId` | Temporarily public | Return a workspace-scoped client |
| `POST /api/workspaces/:workspaceSlug/clients` | Temporarily public | Create a client |
| `PATCH /api/workspaces/:workspaceSlug/clients/:clientId` | Temporarily public | Update permitted client fields |
| `POST /api/workspaces/:workspaceSlug/clients/:clientId/archive` | Temporarily public | Archive a client |

Client endpoints will be protected during the workspace-authorization phase.

## Verification

Run from the repository root:

```bash
pnpm --dir apps/api build
pnpm --dir apps/web build
pnpm --dir apps/api lint
pnpm --dir apps/web lint
pnpm --dir apps/api test
pnpm --dir apps/api test:e2e
```

API end-to-end tests require:

- Running PostgreSQL
- Applied migrations
- A generated Prisma client
- Test authentication configuration

## Development workflow

- Start from a clean, current `main` branch.
- Use one focused feature or documentation branch per task.
- Avoid unrelated changes.
- Use Conventional Commits.
- Run the relevant verification before committing.
- Never commit credentials, tokens, generated Prisma clients, or local
  environment files.
- Open a pull request and review it before merging.

Example commit messages:

```text
feat(api): add workspace-scoped client creation
feat(auth): add Clerk authentication foundation
docs: add project overview and setup guide
```

## Documentation

- [Product Scope](docs/PRODUCT_SCOPE.md)
- [MVP Roadmap](docs/ROADMAP.md)
- [Project Status](docs/PROJECT_STATUS.md)
- [Clerk Authentication Setup](docs/CLERK_AUTHENTICATION.md)

## Planned work

The next major implementation areas are:

- Workspace membership authorization
- Role-based access enforcement
- Client management dashboard
- Automation and automation-run persistence
- Local n8n integration
- Fixture-backed reporting workflow
- Redis-backed background processing
- AI-assisted report generation
- Human review and approval
- Email delivery
- One live marketing-data connector
- Execution history and monitoring
- CI and deployment preparation

Refer to the [MVP Roadmap](docs/ROADMAP.md) for the authoritative sequence.

## License

MIT