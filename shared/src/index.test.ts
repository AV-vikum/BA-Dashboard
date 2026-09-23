import { describe, expect, it } from 'vitest';
import { COLLECTIONS, DEMO_PROJECT_ID } from './index.js';

describe('index exports', () => {
  it('re-exports constants', () => {
    expect(DEMO_PROJECT_ID).toBe('demo-ba-dashboard');
    expect(COLLECTIONS.reports).toBe('reports');
  });
});
