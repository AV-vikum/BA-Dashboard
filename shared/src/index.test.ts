import { describe, expect, it } from 'vitest';
import { APP_ID } from './index.js';

describe('APP_ID', () => {
  it('is set', () => {
    expect(APP_ID).toBe('ba-dashboard');
  });
});
