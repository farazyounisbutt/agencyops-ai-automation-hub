import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { createPublicKey } from 'node:crypto';

@Injectable()
export class ClerkVerifier {
  private readonly client: ReturnType<typeof createClerkClient>;
  private readonly authorizedParties: string[];
  private readonly jwtKey: string;

  constructor(config: ConfigService) {
    const secretKey = config.get<string>('CLERK_SECRET_KEY');
    const publishableKey = config.get<string>('CLERK_PUBLISHABLE_KEY');
    const jwtKey = config.get<string>('CLERK_JWT_KEY')?.replace(/\\n/g, '\n');
    const parties = config.get<string>('CLERK_AUTHORIZED_PARTIES');
    try {
      if (
        !secretKey ||
        !/^sk_(test|live)_/.test(secretKey) ||
        !publishableKey ||
        !jwtKey ||
        !parties
      )
        throw new Error();
      if (!/^pk_(test|live)_/.test(publishableKey)) throw new Error();
      const publicKey = createPublicKey(jwtKey);
      if (publicKey.asymmetricKeyType !== 'rsa') throw new Error();
      this.authorizedParties = parties
        .split(',')
        .map((origin) => origin.trim());
      if (
        this.authorizedParties.some((origin) => {
          const url = new URL(origin);
          return (
            !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
          );
        })
      )
        throw new Error();
      this.jwtKey = jwtKey;
      this.client = createClerkClient({ publishableKey, secretKey });
    } catch {
      throw new Error(
        'Invalid Clerk authentication configuration. Check the API environment.',
      );
    }
  }

  async verify(authorization: string | undefined): Promise<string> {
    if (!authorization || !/^Bearer [^\s,]+$/i.test(authorization)) {
      throw new UnauthorizedException();
    }
    try {
      // Forward only the Bearer credential. Do not trust incoming host, cookie,
      // forwarded headers, or browser-supplied identity fields.
      const request = new Request('http://agencyops.internal/api/me', {
        headers: { Authorization: authorization },
      });
      const state = await this.client.authenticateRequest(request, {
        jwtKey: this.jwtKey,
        acceptsToken: 'session_token',
        authorizedParties: this.authorizedParties,
        clockSkewInMs: 5000,
      });
      const auth = state.toAuth();
      if (
        !state.isAuthenticated ||
        !auth?.isAuthenticated ||
        !auth.userId ||
        !auth.sessionId
      ) {
        throw new UnauthorizedException();
      }
      // Browser sessions must identify an allowed originating application;
      // reject absent azp as well as the SDK's disallowed-party cases.
      if (
        !auth.sessionClaims.azp ||
        !this.authorizedParties.includes(auth.sessionClaims.azp)
      ) {
        throw new UnauthorizedException();
      }
      return auth.userId;
    } catch {
      // SDK errors can contain token details. Never log or return those errors.
      throw new UnauthorizedException();
    }
  }
}
