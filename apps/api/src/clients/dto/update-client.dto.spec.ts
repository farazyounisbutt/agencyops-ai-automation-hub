import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateClientDto } from './update-client.dto.js';
import { configureApp } from '../../configure-app.js';
import type { INestApplication } from '@nestjs/common';

describe('UpdateClientDto through application validation', () => {
  let pipe: ValidationPipe;
  beforeEach(() => {
    const useGlobalPipes = vi.fn((configured: ValidationPipe) => {
      pipe = configured;
    });
    configureApp({
      setGlobalPrefix: vi.fn(),
      enableCors: vi.fn(),
      useGlobalPipes,
    } as unknown as INestApplication);
  });
  const valid = { name: 'Acme', slug: 'acme' };
  const metadata = { type: 'body' as const, metatype: UpdateClientDto };

  it('trims names and produces a concrete DTO without coercing other fields', async () => {
    const result = await pipe.transform(
      { ...valid, name: '  Acme  ', website: null, timezone: 'Asia/Karachi' },
      metadata,
    );
    expect(result).toBeInstanceOf(UpdateClientDto);
    expect(result).toEqual({
      ...valid,
      website: null,
      timezone: 'Asia/Karachi',
    });
  });

  it.each([
    {},
    { website: null },
    { website: 'http://localhost' },
    { website: 'https://acme.example/report' },
    { timezone: 'UTC' },
    { name: 'a'.repeat(200), slug: 'a'.repeat(100) },
  ])('accepts valid optional fields and boundaries: %j', async (fields) => {
    await expect(
      pipe.transform({ ...valid, ...fields }, metadata),
    ).resolves.toBeInstanceOf(UpdateClientDto);
  });

  it.each([
    { name: null },
    { name: 12 },
    { name: '   ' },
    { name: 'a'.repeat(201) },
    { slug: null },
    { slug: 12 },
    { slug: '' },
    { slug: 'a'.repeat(101) },
    { slug: 'Acme' },
    { slug: ' acme' },
    { slug: 'acme ' },
    { slug: 'acme\n' },
    { slug: 'acme\r\n' },
    { slug: '-acme' },
    { slug: 'acme-' },
    { slug: 'acme--studio' },
    { slug: 'acme_studio' },
    { website: '' },
    { website: 12 },
    { website: 'acme.example' },
    { website: 'ftp://acme.example' },
    { timezone: null },
    { timezone: '' },
    { timezone: 12 },
    { timezone: 'Not/AZone' },
    { timezone: '+05:00' },
    { timezone: '-0500' },
    { workspaceId: 'injected' },
    { workspace: {} },
    { status: 'ACTIVE' },
    { id: 'injected' },
    { createdAt: '2026-01-01' },
    { updatedAt: '2026-01-01' },
    { extra: true },
  ])('rejects invalid or forbidden fields: %j', async (fields) => {
    await expect(
      pipe.transform({ ...valid, ...fields }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { name: 'A' },
    { slug: 'a' },
    { website: null },
    { timezone: 'UTC' },
  ])('accepts an individual update: %j', async (input) => {
    await expect(pipe.transform(input, metadata)).resolves.toMatchObject(input);
  });
});
