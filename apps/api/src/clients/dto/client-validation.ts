export const CLIENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;

export const CLIENT_WEBSITE_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_valid_protocol: true,
  require_tld: false,
};

export function trimClientName({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
