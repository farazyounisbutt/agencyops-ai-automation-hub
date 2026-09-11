import { BadRequestException } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import type { ClientsService } from './clients.service.js';

describe('ClientsController archive body', () => {
  const archive = vi.fn();
  const controller = new ClientsController({
    archive,
  } as unknown as ClientsService);
  beforeEach(() => archive.mockReset());

  it.each([undefined, {}])('accepts no body or an empty object: %j', (body) => {
    archive.mockReturnValue('archived');
    expect(controller.archive('workspace', 'client-id', body)).toBe('archived');
    expect(archive).toHaveBeenCalledWith('workspace', 'client-id');
  });
  it.each([
    null,
    [],
    'text',
    1,
    false,
    { status: 'ARCHIVED' },
    { name: 'New' },
    { extra: true },
  ])('rejects body changes and non-object bodies: %j', (body) => {
    expect(() => controller.archive('workspace', 'client-id', body)).toThrow(
      BadRequestException,
    );
    expect(archive).not.toHaveBeenCalled();
  });
});
