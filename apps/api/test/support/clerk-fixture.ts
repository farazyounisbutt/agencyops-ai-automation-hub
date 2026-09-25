import { generateKeyPairSync, sign } from 'node:crypto';

// Test-only signing. Production delegates all JWT verification to Clerk.
export const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const testOrigin = 'http://localhost:3000';
export const testIssuer = 'https://agencyops-test.clerk.accounts.dev';
export const testPublishableKey = `pk_test_${Buffer.from('agencyops-test.clerk.accounts.dev$').toString('base64')}`;
export const testPublicKey = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

export function sessionToken(
  claims: Record<string, unknown> = {},
  privateKey = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_test',
      sid: 'sess_test',
      iss: testIssuer,
      azp: testOrigin,
      iat: now,
      nbf: now - 10,
      exp: now + 60,
      v: 2,
      ...claims,
    }),
  ).toString('base64url');
  const data = `${header}.${payload}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

export function testClerkEnvironment() {
  return {
    CLERK_SECRET_KEY: 'sk_test_synthetic_not_a_real_secret',
    CLERK_PUBLISHABLE_KEY: testPublishableKey,
    CLERK_JWT_KEY: testPublicKey,
    CLERK_AUTHORIZED_PARTIES: testOrigin,
  };
}
