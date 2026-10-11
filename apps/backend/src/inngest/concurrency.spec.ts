import { afterEach, describe, expect, it, vi } from 'vitest';
import { capInngestConcurrency } from './concurrency';

afterEach(() => vi.unstubAllEnvs());

describe('Inngest account concurrency', () => {
  it('allows a free account to sync high-volume functions', () => {
    vi.stubEnv('INNGEST_CONCURRENCY_LIMIT', undefined);
    expect(capInngestConcurrency(500)).toBe(5);
    expect(capInngestConcurrency(1)).toBe(1);
  });
  it('supports higher plan limits without raising provider limits', () => {
    vi.stubEnv('INNGEST_CONCURRENCY_LIMIT', '50');
    expect(capInngestConcurrency(500)).toBe(50);
    expect(capInngestConcurrency(3)).toBe(3);
  });
  it.each(['', '0', '-1', '1.5', 'invalid'])('rejects invalid cap %s', (value) => {
    vi.stubEnv('INNGEST_CONCURRENCY_LIMIT', value);
    expect(() => capInngestConcurrency(10)).toThrow('positive integer');
  });
});
