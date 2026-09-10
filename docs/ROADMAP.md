# AgencyOps MVP roadmap

This roadmap defines planned work from the foundation documented in
[Project status](PROJECT_STATUS.md). [Product scope](PRODUCT_SCOPE.md) defines
the reporting workflow and architecture boundaries. All phases below are pending;
**Client creation is the immediate next implementation task** within the
Client Write API phase.

Use one focused task per feature branch. A phase can require several branches;
include relevant validation and tests with each implementation change.
Client Write API may be split into separate focused tasks for create, update,
and archive, starting with creation.

## Implementation phases

| Phase | Deliverable and completion criteria |
| --- | --- |
| 1. Client write API | Add workspace-scoped create, update, and archive operations. Validate inputs and test missing workspaces, duplicate slugs, invalid requests, and cross-workspace isolation. |
| 2. Authentication and workspace authorization | Authenticate users and enforce workspace membership/role rules in NestJS across read and write operations. Verify unauthorized and cross-workspace requests are denied before real-user exposure. |
| 3. Client management dashboard | Replace the Next.js scaffold with authenticated client list/detail and create/update/archive flows, including loading, empty, and error states. |
| 4. Automation and automation-run database models | Add Prisma migrations for workspace/client-linked automation definitions and runs. Persist trigger context, lifecycle state, execution correlation, timestamps, and audit history through NestJS. |
| 5. n8n Docker service and local configuration | Add n8n to the development setup in a later implementation branch. Select and pin a version, document local credentials/webhook URLs using sanitized templates, and keep n8n operational storage separate from core business records. |
| 6. NestJS-to-n8n webhook integration | Create a run before dispatch, invoke n8n, and accept authenticated, validated, correlated callbacks. Test dispatch failure, duplicate callbacks, and invalid state updates. |
| 7. First fixture-based reporting workflow | Trigger manually and retrieve repeatable client performance data through a fixture data provider. Define the normalized input contract that the later live connector will also use. Return a deterministic draft/result and status to NestJS to establish the execution path before adding AI. |
| 8. Redis-backed background jobs and retry handling | Move long-running dispatch/processing to background jobs with bounded retries and recorded attempts. Test transient failures, exhausted retries, and duplicate processing without duplicate business effects. |
| 9. AI analysis and report generation | Replace the deterministic draft with AI-assisted insights and a persisted report draft tied to its run and inputs. Handle provider errors and preserve enough provenance for review. |
| 10. Human review and approval | Present drafts in the dashboard. NestJS enforces review permissions and records approval/rejection, reviewer, time, and report version. Rejected or unreviewed reports cannot be delivered. |
| 11. Email delivery | Deliver only approved reports and persist delivery attempts/outcomes. Handle send failures and retries without duplicate delivery; show the result to the user. |
| 12. First live marketing-data connector | Select and integrate one real provider. Convert its data into the same normalized input contract used by fixtures and run it through the existing report, review, approval, and delivery lifecycle. Complete a focused technical decision on the provider before implementation, considering API accessibility, development cost, and demonstration value. |
| 13. Execution history and monitoring | Complete the dashboard history for run status, failures, retries, review, and delivery. Add operational visibility for stuck/failed runs. After the manual end-to-end path works, add n8n scheduling through the same NestJS run-creation and approval lifecycle. |
| 14. CI and deployment preparation | Automate builds, lint, tests, and migration/client-generation checks. Document deployment configuration, secrets provisioning, service health, migration rollout, and recovery; verify the complete reporting flow before release. |

History persistence begins with the run models and grows with each phase;
phase 13 completes the user-facing history and monitoring rather than deferring
failure/retry/approval/delivery records until then. Scheduling follows successful
manual reporting and remains inside the MVP.

The live provider decision does not block the earlier fixture workflow. Fixture
data is for development and testing and does not count as the required live
external connector.

## Milestone checks

- After phases 1–3: an authenticated workspace member can manage clients in
  the dashboard, with access rules enforced by NestJS.
- After phases 4–8: a manual request creates a durable run, executes the n8n
  fixture workflow, and returns a correlated result with visible retry outcomes.
- After phases 9–11: AI output becomes a reviewable draft; rejection blocks
  delivery and approval permits tracked email delivery.
- After phase 12: one selected live marketing-data connector uses the same
  normalized input contract and report lifecycle as fixtures, with mandatory
  human approval before delivery in both cases.
- After phases 13–14: manual and scheduled runs use the same lifecycle, full
  history is visible, and CI/deployment checks cover the end-to-end workflow.

## Scope guardrails

NestJS remains the application backend and PostgreSQL the system of record.
n8n orchestrates workflows and integrations; it must not directly own core
business data. Redis supports background execution, caching, and retries, while
Next.js provides the agency-facing dashboard.

Only one live performance-data connector is included in the MVP; additional
third-party integrations are outside scope. Start with a fixture adapter, then
select the live provider through a focused technical decision before connector
implementation. Exact webhook/job/schema contracts remain implementation
decisions within this scope. This documentation branch does not add application
code, services, or dependencies.
