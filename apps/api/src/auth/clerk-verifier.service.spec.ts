import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ClerkVerifier } from './clerk-verifier.service.js';
import {
  sessionToken,
  testClerkEnvironment,
} from '../../test/support/clerk-fixture.js';

describe('ClerkVerifier', () => {
  const verifier = new ClerkVerifier(new ConfigService(testClerkEnvironment()));
  it('verifies a real signed session token through the Clerk SDK', async () => {
    await expect(verifier.verify(`Bearer ${sessionToken()}`)).resolves.toBe(
      'user_test',
    );
  });
  it('verifies without network access when jwtKey is configured', async () => {
    const network = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network access forbidden'));
    try {
      await expect(verifier.verify(`Bearer ${sessionToken()}`)).resolves.toBe(
        'user_test',
      );
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
  it.each([
    undefined,
    '',
    'Basic abc',
    'Bearer',
    'Bearer a b',
    'Bearer a,b',
    'Bearer invalid',
  ])('rejects malformed credentials: %s', async (header) => {
    await expect(verifier.verify(header)).rejects.toThrow(
      UnauthorizedException,
    );
  });
  it.each([
    { exp: 1 },
    { nbf: 9999999999 },
    { iat: 9999999999 },
    { azp: 'https://untrusted.example' },
    { azp: undefined },
    { sid: undefined },
    { sub: undefined },
    { sts: 'pending' },
  ])('rejects invalid session claims: %j', async (claims) => {
    await expect(
      verifier.verify(`Bearer ${sessionToken(claims)}`),
    ).rejects.toThrow(UnauthorizedException);
  });
  it('rejects a token signed by another instance/key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(
      verifier.verify(
        `Bearer ${sessionToken({ iss: 'https://other.clerk.accounts.dev' }, other.privateKey)}`,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
  it('rejects tampering', async () => {
    const token = sessionToken();
    const [header, , signature] = token.split('.');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user_attacker' }),
    ).toString('base64url');
    await expect(
      verifier.verify(`Bearer ${header}.${payload}.${signature}`),
    ).rejects.toThrow(UnauthorizedException);
  });
  it.each([
    'CLERK_SECRET_KEY',
    'CLERK_PUBLISHABLE_KEY',
    'CLERK_JWT_KEY',
    'CLERK_AUTHORIZED_PARTIES',
  ])('fails closed when %s is missing', (key) => {
    expect(
      () =>
        new ClerkVerifier(
          new ConfigService({ ...testClerkEnvironment(), [key]: '' }),
        ),
    ).toThrow('Invalid Clerk authentication configuration');
  });
  it('rejects malformed origins at startup', () => {
    expect(
      () =>
        new ClerkVerifier(
          new ConfigService({
            ...testClerkEnvironment(),
            CLERK_AUTHORIZED_PARTIES: 'https://web.example/path',
          }),
        ),
    ).toThrow('Invalid Clerk authentication configuration');
  });
});
