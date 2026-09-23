import { describe, expect, it } from 'vitest';
import { byteLength, chunkOps, normalizeTags } from './admin-helpers';

describe('byteLength', () => {
  it('counts ASCII as one byte per character', () => {
    expect(byteLength('hello')).toBe(5);
  });

  it('counts multi-byte UTF-8 characters correctly', () => {
    expect(byteLength('é')).toBe(2); // U+00E9, 2 bytes in UTF-8
    expect(byteLength('中')).toBe(3); // U+4E2D, 3 bytes in UTF-8
  });

  it('returns 0 for an empty string', () => {
    expect(byteLength('')).toBe(0);
  });
});

describe('normalizeTags', () => {
  it('trims and lower-cases', () => {
    expect(normalizeTags([' Sales ', 'FINANCE'])).toEqual(['sales', 'finance']);
  });

  it('de-duplicates after normalizing', () => {
    expect(normalizeTags(['Sales', 'sales', ' SALES '])).toEqual(['sales']);
  });

  it('drops empty entries', () => {
    expect(normalizeTags(['sales', '', '   '])).toEqual(['sales']);
  });

  it('caps at the tags limit', () => {
    const many = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    expect(normalizeTags(many)).toHaveLength(10);
  });

  it('preserves first-seen order', () => {
    expect(normalizeTags(['b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });
});

describe('chunkOps', () => {
  it('returns a single chunk when under the limit', () => {
    expect(chunkOps([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it('splits into chunks of the given size', () => {
    expect(chunkOps([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('splits exactly on a boundary with no trailing empty chunk', () => {
    expect(chunkOps([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('returns an empty array for no ops', () => {
    expect(chunkOps([], 500)).toEqual([]);
  });

  it('defaults to the 500-op Firestore batch limit', () => {
    const ops = Array.from({ length: 501 }, (_, i) => i);
    const chunks = chunkOps(ops);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(1);
  });
});
