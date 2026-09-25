# Clerk authentication foundation

Clerk owns credentials, authentication challenges, sessions, and signed identity
tokens. AgencyOps owns User, Workspace, WorkspaceMember, and WorkspaceRole.
NestJS verifies each `/api/me` Bearer token independently. Clerk Organizations,
browser identity headers, and token membership/role claims are not authorization
sources.

## Manual Clerk setup

1. Create or select a Clerk development application. In the Clerk Dashboard,
   open **Access mode**, select **Invite-only**, and save. This is a manual
   dashboard operation; repository code does not change instance settings.
2. Enable the intended email sign-in method. Create or invite only approved
   agency users through the dashboard. Complete their Clerk account setup and
   email verification. No public onboarding route is provided by AgencyOps.
3. From **API keys**, obtain the Publishable Key and Secret Key. Under **Show JWT
   public key**, copy the PEM public key. Use keys from the same instance for the
   web, API, and operator provisioning. Keep development and production instances
   and databases separate.
4. Copy `apps/web/.env.example` to `apps/web/.env.local` and
   `apps/api/.env.example` to `apps/api/.env` only if those destination files do not
   already exist. Otherwise add the required variables privately, preserving
   existing database credentials. Never commit actual environment files.
5. Set the web's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, server-only
   `CLERK_SECRET_KEY`, and `NEXT_PUBLIC_API_URL` (the origin, without `/api`).
   Keep the sign-in URL `/sign-in` and fallback `/` from the example.
6. Set the API's `CLERK_PUBLISHABLE_KEY`, server-only `CLERK_SECRET_KEY`,
   `CLERK_JWT_KEY`, and comma-separated `CLERK_AUTHORIZED_PARTIES` (exact browser
   origins, initially `http://localhost:3000`). Align `WEB_URL` with the permitted
   web origin. PEM line breaks may be dotenv multiline text or literal `\n`.
7. Start the API and web with their existing pnpm development commands. Provision
   the approved local identity using the commands below before expecting
   `/api/me` to succeed.

Production requires HTTPS origins, matching Clerk production keys, and provider
production-domain configuration. Never put the secret key in a `NEXT_PUBLIC_*`
variable, browser code, screenshots, logs, or API responses. The public JWT key
is not a secret, but it must come from the trusted instance. Rotate the configured
PEM key when Clerk signing keys change; no remote-key fallback is enabled here.

## Identity mapping and operator provisioning

The migration adds nullable unique `User.clerkUserId`. Existing UUIDs, profiles,
and memberships remain unchanged. Null means the user cannot access `/api/me`
until an operator links the account. Sign-in does not create or link a local user.
The demo seed intentionally remains unlinked and creates no Clerk account.

Run from the repository root, with API-local database and secret-key configuration:

```sh
# Explicitly link an existing local UUID to an existing Clerk account.
pnpm --dir apps/api provision-user link user_REPLACE LOCAL_USER_UUID

# Explicitly create a local user from an existing Clerk account.
pnpm --dir apps/api provision-user create user_REPLACE
```

The command retrieves the account from Clerk using the server-only secret key.
Creation requires a verified primary email. Linking preserves existing local
email/name and all memberships; it does not infer ownership from email equality.
Repeated provisioning of the same identity is idempotent. Another identity on
the target user, a Clerk identity already owned by another user, or an existing
email during creation causes refusal. An email collision requires deliberate
linking to the correct existing UUID, never an automatic merge. Database uniqueness
constraints handle races. No command creates workspaces or memberships, assigns
roles, or changes Clerk application settings.

The CLI prints only the resulting local UUID on success and a sanitized diagnostic
on failure. API request code does not import the provisioning script.

## Request flow and security boundary

`ClerkProvider` and `src/proxy.ts` establish Next.js authentication context.
The home screen displays sign-in/sign-out state. After sign-in, `useAuth().getToken()`
gets the current session token. The browser calls `GET /api/me` with
`Authorization: Bearer ...`, `credentials: omit`, and no-store caching. It does
not manually persist tokens. Sign-out clears the displayed local profile.

The NestJS guard accepts only a Bearer header, forwards no cookies or untrusted
host/identity headers, and calls `authenticateRequest()` with the approved SDK:

- `publishableKey` and server-only `secretKey` configured on `createClerkClient()`.
- `jwtKey` set to the trusted PEM key for networkless signature verification.
- `acceptsToken: 'session_token'`.
- `authorizedParties` set to exact configured origins.
- `clockSkewInMs: 5000`.

Backend SDK 3.17.2 requires `secretKey` even with `jwtKey`. This does not change the
networkless verification path, which is tested with network access forbidden.
No `CLERK_ISSUER` option, custom JWT verification, or custom token template is used.
Signature and temporal checks are delegated to Clerk. Absent/disallowed `azp`,
missing session identity, and pending sessions are rejected. Tokens signed by
another key/instance are rejected. Offline verification accepts an otherwise valid
issued token until expiry; it does not promise instantaneous revocation after
sign-out. No per-request Clerk session/profile API call is added.

The verified subject is used only to look up `User.clerkUserId`. A successful
response contains `{ id, email, name }` from PostgreSQL and `Cache-Control: no-store`.
No roles, memberships, Clerk metadata, or token contents are returned.

| Condition | HTTP response |
| --- | --- |
| Valid session and linked local user | 200 with local profile |
| Missing/malformed/expired/tampered/wrong-key token or incomplete session | 401 with generic error |
| Valid session, no local mapping | 403, account not provisioned |
| Identity lookup fails | NestJS sanitized 500; access is never granted |

Invalid required API authentication configuration fails startup without including
key values. SDK verification errors are replaced with generic 401 errors before
logging/response handling. No global exception filter is added.

CORS remains restricted to `WEB_URL`; preflight permits the Authorization header
without enabling credentialed cross-origin cookies. CORS is not authentication.

**Temporary scope:** `/api` and `/api/health` remain public. All existing client
routes also remain public, including writes. Workspace authorization and client
route protection are the next task and are required before real-user exposure.
A Clerk sign-in alone does not establish access to any workspace. Clerk Organizations
are not used. Existing client behavior is unchanged.

## Verification and live acceptance

Automated API tests use ephemeral RSA test keys, synthetic nonfunctional Clerk
configuration, the real SDK verifier, and isolated PostgreSQL users/workspaces.
Test-only JWT signing is not part of production code. They cover invalid tokens,
networkless verification, unlinked identities, sanitized database errors, CORS,
public health, provisioning collisions, concurrent creation, and membership
preservation. Existing client suites still run.

Schema/migration checks, explicit Prisma generation, both builds/linters, all unit
and database-backed tests, and repeatable demo seed checks are required. The
pre-existing tsconfck/TypeScript peer mismatch is tracked separately.

Manual live acceptance passed on 2026-09-25 using a Clerk development instance:

- Approved, provisioned sign-in displayed the local user from `/api/me`.
- Reload after waiting for token refresh preserved successful access.
- Sign-out cleared the profile; an unauthenticated `/api/me` request returned 401.
- An unprovisioned user received the access-not-provisioned message.
- Invite-only blocked public registration.
- Request inspection confirmed Bearer authentication; the profile response
  contained only local profile fields, and the browser source search found no
  secret-key value.

The exposed development secret was replaced and revoked. Provisioning and sign-in
were verified with the replacement. Manual testing changed no application code.

Official references:
[Next.js setup](https://clerk.com/docs/nextjs/getting-started/quickstart),
[authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request),
[Invite-only access](https://clerk.com/docs/guides/secure/restricting-access).
