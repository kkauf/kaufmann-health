import { describe, it, expect } from 'vitest';
import { __internals } from '@/lib/logger';

describe('logger internals', () => {
  it('truncateString clamps long strings and appends ellipsis', () => {
    const long = 'a'.repeat(1500);
    const out = __internals.truncateString(long);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(1001); // 1000 + ellipsis
  });

  it('truncateProperties limits arrays and deeply nested objects', () => {
    const input = {
      arr: Array.from({ length: 25 }, (_, i) => i),
      nested: { b: 'x', c: { d: 'y' } },
    };
    const out: any = __internals.truncateProperties(input, 8000);
    // Array limited to 20 items plus ellipsis marker
    expect(Array.isArray(out.arr)).toBe(true);
    expect(out.arr.length).toBe(21);
    expect(out.arr[out.arr.length - 1]).toBe('…');
    // Deep object replaced with placeholder at depth >= 2
    expect(out.nested.c).toBe('[object]');
  });

  it('normalizeError extracts safe fields and truncates stack', () => {
    const err = new Error('boom');
    const out: any = __internals.normalizeError(err);
    expect(out.name).toBe('Error');
    expect(out.message).toBe('boom');
    if (out.stack) {
      expect(typeof out.stack).toBe('string');
      expect(out.stack.length).toBeLessThanOrEqual(2000);
    }
  });
});
