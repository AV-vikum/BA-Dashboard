import { describe, expect, it } from 'vitest';
import { withTheme } from './report-frame';

describe('withTheme', () => {
  it('adds data-theme to a plain <html> tag', () => {
    const result = withTheme('<html><body>hi</body></html>', 'dark');
    expect(result).toBe('<html data-theme="dark"><body>hi</body></html>');
  });

  it('preserves existing attributes on <html>', () => {
    const result = withTheme('<html lang="en"><body>hi</body></html>', 'light');
    expect(result).toBe('<html lang="en" data-theme="light"><body>hi</body></html>');
  });

  it('replaces an existing data-theme attribute', () => {
    const result = withTheme('<html data-theme="light" lang="en">x</html>', 'dark');
    expect(result).toBe('<html lang="en" data-theme="dark">x</html>');
  });

  it('is case-insensitive on the <html> tag', () => {
    const result = withTheme('<HTML><body>hi</body></HTML>', 'dark');
    expect(result).toBe('<html data-theme="dark"><body>hi</body></HTML>');
  });

  it('wraps content that has no <html> tag at all', () => {
    const result = withTheme('<body>hi</body>', 'dark');
    expect(result).toBe('<html data-theme="dark"><body>hi</body></html>');
  });

  it('only touches the first <html> tag when the string contains more than one', () => {
    const result = withTheme('<html><body><html>nested</html></body></html>', 'dark');
    expect(result.startsWith('<html data-theme="dark">')).toBe(true);
  });
});
