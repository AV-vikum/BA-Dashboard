// Turns core results into the short text lines printed by the CLI and returned by MCP tools.
import type { Group, WithId } from '@ba/shared';
import type { AccessChangeResult, AccessView } from './access.js';
import { formatBytes, formatDate, ok, plural, warn } from './output.js';
import type { PublishResult } from './publish.js';
import type { ReportListItem } from './reports.js';

export function publishLines(r: PublishResult): string[] {
  const head = r.created
    ? ok(
        `Created "${r.title}" (${r.status}) → ${r.url} · ${formatBytes(r.bytes)} · ` +
          `${plural(r.viewerCount, 'viewer')}, ${r.externalCount} external`,
      )
    : ok(`Updated "${r.title}" (${r.status}) → ${r.url} · ${formatBytes(r.bytes)}`);
  return [head, ...r.warnings.map(warn)];
}

export function reportListLines(items: ReportListItem[], limit = Infinity): string[] {
  if (!items.length) return ['(no reports)'];
  const shown = items.slice(0, limit).map((r) => {
    const external = r.expired ? `${r.external}e (${r.expired} expired)` : `${r.external}e`;
    return `${r.id.padEnd(20)}  ${r.status.padEnd(9)}  ${(r.slug ?? '-').padEnd(20)}  "${r.title}"  ${r.viewers}v/${external}  ${formatDate(r.updatedAt)}`;
  });
  if (items.length > limit) shown.push(`… ${items.length - limit} more — narrow with a search`);
  return shown;
}

export function groupLines(groups: WithId<Group>[]): string[] {
  if (!groups.length) return ['(no groups)'];
  return groups.map((g) => {
    const members = g.memberEmails.slice(0, 5).join(', ');
    const more = g.memberEmails.length > 5 ? ` +${g.memberEmails.length - 5} more` : '';
    return `${g.name} (${plural(g.memberEmails.length, 'member')}): ${members || '-'}${more}`;
  });
}

export function accessLines(v: AccessView): string[] {
  const lines = [
    `"${v.title}" (${v.id}, ${v.status}) — ${plural(v.viewerCount, 'internal viewer')}`,
    `  direct:   ${v.direct.join(', ') || '-'}`,
    `  groups:   ${v.groups.map((g) => `${g.name} (${g.members})`).join(', ') || '-'}`,
    `  external: ${
      v.external
        .map(
          (e) =>
            `${e.email} (${e.expires ? `until ${e.expires}` : 'no expiry'}${e.active ? '' : ', EXPIRED'})`,
        )
        .join(', ') || '-'
    }`,
  ];
  if (v.status === 'draft')
    lines.push(warn('draft — only admins can see it until it is published'));
  if (v.external.length && !v.externalSharingOn) {
    lines.push(warn('external sharing is turned off in Settings'));
  }
  return lines;
}

export function accessChangeLines(r: AccessChangeResult): string[] {
  const external = r.view.external.length;
  return [
    ok(
      `Access updated for "${r.view.title}": ${plural(r.view.viewerCount, 'viewer')} ` +
        `(+${r.added}, −${r.removed}), ${external} external`,
    ),
    ...r.warnings.map(warn),
  ];
}
