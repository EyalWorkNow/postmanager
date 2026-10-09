import { describe, expect, it } from 'vitest';
import { getCookieUrlFromDomain } from './subdomain.management';

describe('session cookie domain', () => {
  it('keeps Railway sessions within the deployed app', () => {
    expect(getCookieUrlFromDomain('https://postmanager-production-bebc.up.railway.app'))
      .toBe('postmanager-production-bebc.up.railway.app');
  });

  it('keeps private hosting tenants separate', () => {
    expect(getCookieUrlFromDomain('https://example.github.io')).toBe('.example.github.io');
  });

  it('preserves session sharing on custom subdomains', () => {
    expect(getCookieUrlFromDomain('https://app.example.co.uk')).toBe('.example.co.uk');
  });

  it('supports local development', () => {
    expect(getCookieUrlFromDomain('http://localhost:4200')).toBe('localhost');
  });
});
