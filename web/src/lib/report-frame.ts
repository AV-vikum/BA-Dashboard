// Injects/replaces data-theme="light|dark" on the report HTML's <html> tag
// before it's set as the iframe's srcdoc (step 3.7). String manipulation,
// not a DOM parse — this needs to work in a plain test environment and
// the report HTML is never trusted enough to warrant more than a regex
// against the opening tag itself.
const HTML_TAG_PATTERN = /<html\b([^>]*)>/i;

export function withTheme(html: string, theme: 'light' | 'dark'): string {
  const match = HTML_TAG_PATTERN.exec(html);

  if (!match) {
    // No <html> tag at all — wrap the content so the theme attribute still
    // has somewhere to live.
    return `<html data-theme="${theme}">${html}</html>`;
  }

  const attrs = match[1] ?? '';
  const withoutExistingTheme = attrs.replace(/\sdata-theme="[^"]*"/i, '');
  const newTag = `<html${withoutExistingTheme} data-theme="${theme}">`;
  return html.slice(0, match.index) + newTag + html.slice(match.index + match[0].length);
}
