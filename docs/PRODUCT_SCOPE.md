# AgencyOps MVP product scope

## Goal

Give small and medium digital agencies a workspace-based dashboard to manage
clients, trigger a client performance report, review AI-assisted insights,
and deliver an approved report
by email with a visible execution history. n8n is an explicit part of the MVP.

This document defines planned capabilities. See [Project status](PROJECT_STATUS.md)
for what exists today and [Roadmap](ROADMAP.md) for implementation order.

## Target users

The primary application users are:

- Agency owner
- Agency administrator
- Agency team member

Clients do not have application accounts or access the dashboard in the MVP.
They receive approved reports by email.

## Architecture responsibilities

| Component | Responsibility |
| --- | --- |
| NestJS | Application backend; owns business rules, authentication, authorization, persistence, and audit records. Validates workflow requests and callbacks, controls run/report state, and enforces approval before delivery. |
| PostgreSQL | System of record for core application data, including clients, automation definitions, runs, reports, review decisions, and execution/delivery history. |
| n8n | Orchestrates scheduled and manually triggered automation workflows and external integrations. Retrieves performance inputs, coordinates analysis/report generation, and returns results and execution status to NestJS. |
| Redis | Supports queues, background processing, caching, and retries. Durable business state and history remain in PostgreSQL through NestJS. |
| Next.js | Agency-facing dashboard for client management, workflow triggers, draft review, approval/rejection, and execution/delivery history. |

n8n must not become the primary application backend or directly own core
business data. It accesses application data and submits changes through NestJS
contracts, rather than writing core application tables. Any n8n operational
metadata is separate from the application's business records. Dashboard actions
go through NestJS, where workspace authorization is enforced.

NestJS creates a run before dispatch and correlates every n8n callback with that
run. Authenticated requests/callbacks, validated payloads, and idempotent status
updates protect the boundary. Scheduled triggers must also enter through NestJS
so that authorization policy, run creation, and audit records are preserved.
Retries must not duplicate reports or email delivery.

## Target end-to-end reporting workflow

1. A user manually triggers a report workflow for a client from the dashboard.
   Add scheduling afterward, once the manual path works.
2. NestJS authorizes the request and creates an automation-run record in
   PostgreSQL before invoking external workflow execution.
3. NestJS invokes an n8n workflow with the run identifier and scoped inputs.
4. n8n retrieves fixture-based client performance data initially, using a
   repeatable fixture data provider with a normalized input contract shared
   with the later live marketing-data connector.
5. The first fixture-based implementation produces a deterministic draft to
   validate the complete execution path. AI-assisted analysis and draft
   generation replace or extend that deterministic implementation in the later
   AI phase. Keep the input provenance available so reviewers can assess the draft.
6. n8n sends the result and execution status back to NestJS, which validates and
   persists them against the run.
7. The draft is presented in Next.js for human review.
8. The user approves or rejects it. NestJS authorizes and records the decision,
   reviewer, time, and report version. Rejection prevents delivery.
9. An approved report is delivered by email. NestJS enforces the approval gate
   and records the delivery outcome; execution may use a background worker or
   n8n integration, with results returned to NestJS.
10. Execution status, failures, retry attempts, approval/rejection, and delivery
    history remain visible in the application, backed by PostgreSQL records.

Scheduling is a subsequent MVP increment using the same run lifecycle and
human review gate. It must not bypass approval or create an independent source
of business state in n8n.

## Expected report content

- Reporting period
- Data-source information
- KPI summary
- Significant performance changes
- Risks or anomalies
- Recommended actions
- Client-friendly executive summary
- Human edits, approval status, and delivery status

## Included in the MVP

- Client create/update/archive APIs and a client management dashboard.
- Authentication and workspace authorization for application operations.
- Automation and automation-run persistence, followed by report, review, and
  delivery records as needed to support the workflow.
- Local n8n Docker service/configuration and NestJS-to-n8n webhook integration.
- A fixture-based reporting workflow for development and testing, followed by
  one live marketing-data connector using the same reporting lifecycle.
- Redis-backed background jobs and bounded retries with visible outcomes.
- AI-assisted analysis and draft generation with mandatory human review.
- Email delivery of approved reports, execution history, and monitoring.
- Scheduling after the manual workflow, plus CI and deployment preparation.

Fixture data is a development and testing mechanism, not the MVP's real external
connector. One live marketing-data connector is required before MVP completion.
The provider will be selected later based on API accessibility, development
cost, and demonstration value. Only one live performance-data connector is
included in the MVP.
AI and email provider adapters serve this reporting flow and do not imply
additional performance-data integrations.

## Outside the MVP

- Third-party integrations beyond the one live marketing-data connector.
- A connector marketplace, broad multi-provider data ingestion, or a general
  purpose workflow builder for agency users.
- Automatic approval or delivery of unreviewed AI output.
- Moving business rules, authentication, authorization, or ownership of core
  business data into n8n.
- Billing and subscriptions
- Mobile applications
- Client self-service portal
- Advanced predictive analytics
- Complex enterprise permission models
- Large-scale real-time analytics

## MVP acceptance outcome

The first technical workflow is validated with a deterministic fixture-backed
draft. Final MVP acceptance includes AI-assisted report generation.
The fixture-backed workflow must work end to end first: an authorized agency
user can manage a client, trigger a report, inspect and edit a generated draft,
and approve or reject it. Complete MVP acceptance subsequently requires one
selected live marketing-data connector to run through the same report, review,
approval, and email delivery workflow. Human approval is mandatory before
delivery in both cases; rejected or unreviewed reports cannot be delivered.
The dashboard shows the run's status and history, including failures, retries,
the review decision, and delivery outcome. A later
scheduled trigger follows the same lifecycle. Workspace isolation and duplicate
callback/job handling are verified before deployment.
