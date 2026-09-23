import { describe, expect, it } from 'vitest';
import {
  accessSummary,
  applyAccessChange,
  computeViewerEmails,
  isExternalActive,
} from './access.js';
import type { Group, Report, WithId } from './types.js';

function ts(date: Date) {
  return { toDate: () => date };
}

const GROUPS: WithId<Group>[] = [
  {
    id: 'finance',
    name: 'Finance',
    description: '',
    memberEmails: ['alice@example.com', 'bob@example.com'],
    createdAt: ts(new Date()),
    updatedAt: ts(new Date()),
    updatedBy: 'admin@example.com',
  },
  {
    id: 'management',
    name: 'Management',
    description: '',
    memberEmails: ['carol@example.com', 'alice@example.com'], // overlaps with finance
    createdAt: ts(new Date()),
    updatedAt: ts(new Date()),
    updatedBy: 'admin@example.com',
  },
];

describe('computeViewerEmails', () => {
  it('unions direct emails and group members, de-duplicated and sorted', () => {
    expect(computeViewerEmails(['dave@example.com'], ['finance'], GROUPS)).toEqual([
      'alice@example.com',
      'bob@example.com',
      'dave@example.com',
    ]);
  });

  it('de-duplicates overlap between direct emails and group members', () => {
    expect(computeViewerEmails(['alice@example.com'], ['finance'], GROUPS)).toEqual([
      'alice@example.com',
      'bob@example.com',
    ]);
  });

  it('de-duplicates overlap between two groups', () => {
    expect(computeViewerEmails([], ['finance', 'management'], GROUPS)).toEqual([
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
    ]);
  });

  it('ignores unknown group ids', () => {
    expect(computeViewerEmails(['dave@example.com'], ['nonexistent'], GROUPS)).toEqual([
      'dave@example.com',
    ]);
  });
});

function baseReport(): Pick<
  Report,
  'directEmails' | 'groupIds' | 'externalEmails' | 'externalExpiry'
> {
  return { directEmails: [], groupIds: [], externalEmails: [], externalExpiry: {} };
}

describe('isExternalActive', () => {
  it('is true with no expiry', () => {
    const report = {
      externalEmails: ['ext@outside.test'],
      externalExpiry: { 'ext@outside.test': null },
    };
    expect(isExternalActive(report, 'ext@outside.test')).toBe(true);
  });

  it('is true when expiry is in the future', () => {
    const future = ts(new Date(Date.now() + 86_400_000));
    const report = {
      externalEmails: ['ext@outside.test'],
      externalExpiry: { 'ext@outside.test': future },
    };
    expect(isExternalActive(report, 'ext@outside.test')).toBe(true);
  });

  it('is false when expiry is in the past', () => {
    const past = ts(new Date(Date.now() - 86_400_000));
    const report = {
      externalEmails: ['ext@outside.test'],
      externalExpiry: { 'ext@outside.test': past },
    };
    expect(isExternalActive(report, 'ext@outside.test')).toBe(false);
  });

  it('is false when the email is not in externalEmails', () => {
    const report = { externalEmails: [], externalExpiry: {} };
    expect(isExternalActive(report, 'stranger@outside.test')).toBe(false);
  });
});

describe('applyAccessChange', () => {
  const allowedDomains = ['example.com'];

  it('adds and removes direct emails', () => {
    const report = { ...baseReport(), directEmails: ['alice@example.com'] };
    const result = applyAccessChange(
      report,
      { addEmails: ['dave@example.com'], removeEmails: ['alice@example.com'] },
      GROUPS,
      allowedDomains,
    );
    expect(result.directEmails).toEqual(['dave@example.com']);
    expect(result.viewerEmails).toEqual(['dave@example.com']);
    expect(result.warnings).toEqual([]);
  });

  it('adds and removes groups, recomputing viewerEmails', () => {
    const report = baseReport();
    const added = applyAccessChange(report, { addGroupIds: ['finance'] }, GROUPS, allowedDomains);
    expect(added.groupIds).toEqual(['finance']);
    expect(added.viewerEmails).toEqual(['alice@example.com', 'bob@example.com']);

    const removed = applyAccessChange(
      { ...report, groupIds: ['finance'] },
      { removeGroupIds: ['finance'] },
      GROUPS,
      allowedDomains,
    );
    expect(removed.groupIds).toEqual([]);
    expect(removed.viewerEmails).toEqual([]);
  });

  it('does not duplicate viewerEmails when direct and group overlap', () => {
    const report = { ...baseReport(), directEmails: ['alice@example.com'], groupIds: ['finance'] };
    const result = applyAccessChange(report, {}, GROUPS, allowedDomains);
    expect(result.viewerEmails).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('adds external emails with and without expiry', () => {
    const report = baseReport();
    const future = new Date(Date.now() + 86_400_000);
    const result = applyAccessChange(
      report,
      {
        addExternal: [
          { email: 'ext1@outside.test', expires: null },
          { email: 'ext2@outside.test', expires: future },
        ],
      },
      GROUPS,
      allowedDomains,
    );
    expect(result.externalEmails).toEqual(['ext1@outside.test', 'ext2@outside.test']);
    expect(result.externalExpiry['ext1@outside.test']).toBeNull();
    expect(result.externalExpiry['ext2@outside.test']?.toDate()).toEqual(future);
  });

  it('removes external emails and their expiry entries', () => {
    const report = {
      ...baseReport(),
      externalEmails: ['ext@outside.test'],
      externalExpiry: { 'ext@outside.test': null },
    };
    const result = applyAccessChange(
      report,
      { removeExternal: ['ext@outside.test'] },
      GROUPS,
      allowedDomains,
    );
    expect(result.externalEmails).toEqual([]);
    expect(result.externalExpiry).toEqual({});
  });

  it('rejects an email outside allowed domains from directEmails, with a warning', () => {
    const report = baseReport();
    const result = applyAccessChange(
      report,
      { addEmails: ['someone@gmail.com'] },
      GROUPS,
      allowedDomains,
    );
    expect(result.directEmails).toEqual([]);
    expect(result.warnings).toEqual([
      'someone@gmail.com is outside allowed domains — add as external instead',
    ]);
  });
});

describe('accessSummary', () => {
  it('counts internal and external viewers and lists expired external emails', () => {
    const past = ts(new Date(Date.now() - 86_400_000));
    const future = ts(new Date(Date.now() + 86_400_000));
    const report: Pick<Report, 'viewerEmails' | 'externalEmails' | 'externalExpiry'> = {
      viewerEmails: ['alice@example.com', 'bob@example.com'],
      externalEmails: ['expired@outside.test', 'active@outside.test'],
      externalExpiry: { 'expired@outside.test': past, 'active@outside.test': future },
    };
    expect(accessSummary(report)).toEqual({
      internalCount: 2,
      externalCount: 2,
      expiredExternal: ['expired@outside.test'],
    });
  });
});
