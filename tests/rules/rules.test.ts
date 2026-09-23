// Security-rules tests — see docs/plan/phase-2-data-and-rules.md §2.7 for
// the numbered case table this file implements 1:1.
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeEach, describe, it } from 'vitest';
import {
  ADMIN_EMAIL,
  authedFirestore,
  createTestEnv,
  DRAFT_REPORT_ID,
  EXTERNAL_EMAIL,
  EXTERNAL_FUTURE_REPORT_ID,
  EXTERNAL_NO_EXPIRY_REPORT_ID,
  EXTERNAL_PAST_REPORT_ID,
  GROUP_ID,
  GROUP_MEMBER_EMAIL,
  OTHER_DOMAIN_LISTED_EMAIL,
  PUBLISHED_REPORT_DIRECT_EMAIL,
  PUBLISHED_REPORT_ID,
  seed,
  UNASSIGNED_INTERNAL_EMAIL,
  uidFromEmail,
} from './helpers.js';

let testEnv: RulesTestEnvironment;

beforeEach(async () => {
  testEnv = await createTestEnv();
  await testEnv.clearFirestore();
  await seed(testEnv);
});

afterAll(async () => {
  await testEnv?.cleanup();
});

// #1 — unauthenticated read of any report / config
describe('unauthenticated access', () => {
  it('cannot read a published report or config/access', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
    await assertFails(getDoc(doc(db, 'config', 'access')));
  });
});

// #2 — signed in but email_verified: false
describe('unverified email', () => {
  it('is denied everywhere, including a report it would otherwise see', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL, { verified: false });
    await assertFails(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
    await assertFails(getDoc(doc(db, 'config', 'access')));
  });
});

// #3, #4, #5 — internal viewer on a published, assigned report
describe('internal viewer', () => {
  it('can get a published, assigned report and its content', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);
    await assertSucceeds(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
    await assertSucceeds(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID, 'content', 'main')));
  });

  it('can list reports with viewerEmails + status filters', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);
    const q = query(
      collection(db, 'reports'),
      where('viewerEmails', 'array-contains', PUBLISHED_REPORT_DIRECT_EMAIL),
      where('status', '==', 'published'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('cannot list reports without the status filter', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);
    const q = query(
      collection(db, 'reports'),
      where('viewerEmails', 'array-contains', PUBLISHED_REPORT_DIRECT_EMAIL),
    );
    await assertFails(getDocs(q));
  });

  // #6 — internal user not assigned to any report
  it('cannot get a report it is not assigned to', async () => {
    const db = authedFirestore(testEnv, UNASSIGNED_INTERNAL_EMAIL);
    await assertFails(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
    await assertFails(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID, 'content', 'main')));
  });

  // #7 — internal viewer on a draft
  it('cannot get a draft report even if assigned', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);
    await assertFails(getDoc(doc(db, 'reports', DRAFT_REPORT_ID)));
  });

  // #8 — viewer whose domain was removed from allowedDomains
  it('loses access once its domain is removed from allowedDomains', async () => {
    await seed(testEnv, { allowedDomains: ['other-allowed.test'] });
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);
    await assertFails(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
  });

  // #9 — user from another domain listed in viewerEmails (not external)
  it('cannot read via viewerEmails if its own domain is not allowed', async () => {
    const db = authedFirestore(testEnv, OTHER_DOMAIN_LISTED_EMAIL);
    await assertFails(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
  });

  // #24 — upper-case email in the auth token matches lower-case stored data
  it('matches viewerEmails case-insensitively', async () => {
    const db = authedFirestore(testEnv, 'Alice@Example.com');
    await assertSucceeds(getDoc(doc(db, 'reports', PUBLISHED_REPORT_ID)));
  });
});

// #10, #11, #12, #13 — external viewers
describe('external viewer', () => {
  it('can get a report with no expiry, plus its content', async () => {
    const db = authedFirestore(testEnv, EXTERNAL_EMAIL);
    await assertSucceeds(getDoc(doc(db, 'reports', EXTERNAL_NO_EXPIRY_REPORT_ID)));
    await assertSucceeds(
      getDoc(doc(db, 'reports', EXTERNAL_NO_EXPIRY_REPORT_ID, 'content', 'main')),
    );
  });

  it('can list reports via externalEmails + status', async () => {
    const db = authedFirestore(testEnv, EXTERNAL_EMAIL);
    const q = query(
      collection(db, 'reports'),
      where('externalEmails', 'array-contains', EXTERNAL_EMAIL),
      where('status', '==', 'published'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('can read metadata but not content once expiry is in the past (documented limitation)', async () => {
    const db = authedFirestore(testEnv, EXTERNAL_EMAIL);
    await assertSucceeds(getDoc(doc(db, 'reports', EXTERNAL_PAST_REPORT_ID)));
    await assertFails(getDoc(doc(db, 'reports', EXTERNAL_PAST_REPORT_ID, 'content', 'main')));
  });

  it('can read content while expiry is in the future', async () => {
    const db = authedFirestore(testEnv, EXTERNAL_EMAIL);
    await assertSucceeds(getDoc(doc(db, 'reports', EXTERNAL_FUTURE_REPORT_ID, 'content', 'main')));
  });

  // #14 — allowExternalSharing = false
  it('is denied entirely when external sharing is switched off', async () => {
    await seed(testEnv, { allowExternalSharing: false });
    const db = authedFirestore(testEnv, EXTERNAL_EMAIL);
    await assertFails(getDoc(doc(db, 'reports', EXTERNAL_NO_EXPIRY_REPORT_ID)));
  });
});

// #15, #16 — admin access
describe('admin', () => {
  it('can read and write reports, content, groups, config, and users', async () => {
    const db = authedFirestore(testEnv, ADMIN_EMAIL);

    await assertSucceeds(getDoc(doc(db, 'reports', DRAFT_REPORT_ID)));
    await assertSucceeds(updateDoc(doc(db, 'reports', DRAFT_REPORT_ID), { title: 'Renamed' }));
    await assertSucceeds(
      updateDoc(doc(db, 'reports', DRAFT_REPORT_ID, 'content', 'main'), { html: '<p>x</p>' }),
    );
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_ID)));
    await assertSucceeds(updateDoc(doc(db, 'groups', GROUP_ID), { description: 'Updated' }));
    await assertSucceeds(getDoc(doc(db, 'config', 'admins')));
    await assertSucceeds(
      setDoc(doc(db, 'config', 'admins'), {
        emails: [ADMIN_EMAIL],
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN_EMAIL,
      }),
    );
    await assertSucceeds(getDoc(doc(db, 'users', uidFromEmail(GROUP_MEMBER_EMAIL))));
  });

  it('non-admins cannot write reports, content, groups, or config', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);

    await assertFails(updateDoc(doc(db, 'reports', PUBLISHED_REPORT_ID), { title: 'Hacked' }));
    await assertFails(
      updateDoc(doc(db, 'reports', PUBLISHED_REPORT_ID, 'content', 'main'), { html: '<p>x</p>' }),
    );
    await assertFails(updateDoc(doc(db, 'groups', GROUP_ID), { description: 'Hacked' }));
    await assertFails(
      setDoc(doc(db, 'config', 'access'), {
        allowedDomains: ['evil.com'],
        allowExternalSharing: true,
        updatedAt: serverTimestamp(),
        updatedBy: PUBLISHED_REPORT_DIRECT_EMAIL,
      }),
    );
  });

  // #17 — non-admin reads config/admins
  it('non-admins cannot read config/admins', async () => {
    const db = authedFirestore(testEnv, PUBLISHED_REPORT_DIRECT_EMAIL);
    await assertFails(getDoc(doc(db, 'config', 'admins')));
  });

  // #23 — admin removes all admins
  it('cannot write an empty admins list', async () => {
    const db = authedFirestore(testEnv, ADMIN_EMAIL);
    await assertFails(
      setDoc(doc(db, 'config', 'admins'), {
        emails: [],
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN_EMAIL,
      }),
    );
  });
});

// #18 — config/access is readable by any verified user
describe('config/access', () => {
  it('is readable by any signed-in, verified user', async () => {
    const db = authedFirestore(testEnv, UNASSIGNED_INTERNAL_EMAIL);
    await assertSucceeds(getDoc(doc(db, 'config', 'access')));
  });
});

// #19, #20, #21, #22 — user profiles
describe('user profiles', () => {
  it('a user can create their own profile with only the allowed fields', async () => {
    const email = 'newuser@example.com';
    const db = authedFirestore(testEnv, email);
    await assertSucceeds(
      setDoc(doc(db, 'users', uidFromEmail(email)), {
        email,
        displayName: 'New User',
        photoURL: null,
        lastLoginAt: serverTimestamp(),
      }),
    );
  });

  it('cannot write a profile with an extra field', async () => {
    const email = 'newuser@example.com';
    const db = authedFirestore(testEnv, email);
    await assertFails(
      setDoc(doc(db, 'users', uidFromEmail(email)), {
        email,
        displayName: 'New User',
        photoURL: null,
        lastLoginAt: serverTimestamp(),
        role: 'admin',
      }),
    );
  });

  it("cannot write someone else's profile", async () => {
    const email = 'newuser@example.com';
    const otherUid = uidFromEmail('someoneelse@example.com');
    const db = authedFirestore(testEnv, email);
    await assertFails(
      setDoc(doc(db, 'users', otherUid), {
        email,
        displayName: null,
        photoURL: null,
        lastLoginAt: serverTimestamp(),
      }),
    );
  });

  it('cannot write a profile with a different email than the token', async () => {
    const email = 'newuser@example.com';
    const db = authedFirestore(testEnv, email);
    await assertFails(
      setDoc(doc(db, 'users', uidFromEmail(email)), {
        email: 'someoneelse@example.com',
        displayName: null,
        photoURL: null,
        lastLoginAt: serverTimestamp(),
      }),
    );
  });
});
