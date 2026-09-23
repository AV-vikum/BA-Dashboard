// Writes config/access and config/admins — the two documents Security
// Rules read to decide who is "internal" and who is an admin.
import { parseArgs } from 'node:util';
import { FieldValue } from 'firebase-admin/firestore';
import { isValidDomain, isValidEmail, normalizeDomain, normalizeEmail } from '@ba/shared';
import { assertEmulatorRunning, getDb } from '../core/firebase.js';
import { env, targetLabel } from '../core/env.js';

function parseList(value: string | undefined, label: string): string[] {
  if (!value) return [];
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (items.length === 0) {
    throw new Error(`--${label} was given but contained no values`);
  }
  return items;
}

function printUsage(): void {
  console.log(
    [
      'Usage: npm run setup -- --domains a.com,b.lk --admins x@a.com,y@a.com [--external on|off]',
      '',
      '  --domains   required, comma-separated allowed email domains',
      '  --admins    required, comma-separated admin emails',
      '  --external  optional, "on" (default) or "off"',
      '',
      'Target is chosen by BA_TARGET (emulator by default). Production requires --yes.',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      domains: { type: 'string' },
      admins: { type: 'string' },
      external: { type: 'string', default: 'on' },
      yes: { type: 'boolean', default: false },
    },
  });

  if (!values.domains || !values.admins) {
    printUsage();
    process.exit(1);
  }

  if (values.external !== 'on' && values.external !== 'off') {
    console.error(`✗ --external must be "on" or "off", got "${values.external}"`);
    process.exit(1);
  }

  const domains = parseList(values.domains, 'domains').map(normalizeDomain);
  const admins = parseList(values.admins, 'admins').map(normalizeEmail);
  const allowExternalSharing = values.external === 'on';

  for (const domain of domains) {
    if (!isValidDomain(domain)) {
      console.error(`✗ Invalid domain: "${domain}"`);
      process.exit(1);
    }
  }
  for (const email of admins) {
    if (!isValidEmail(email)) {
      console.error(`✗ Invalid email: "${email}"`);
      process.exit(1);
    }
  }

  console.log(`Target: ${targetLabel()}`);

  if (env.target === 'production' && !values.yes) {
    console.log('\nThis would write to a PRODUCTION project:');
    console.log(`  config/access.allowedDomains       -> ${JSON.stringify(domains)}`);
    console.log(`  config/access.allowExternalSharing -> ${allowExternalSharing}`);
    console.log(`  config/admins.emails               -> ${JSON.stringify(admins)}`);
    console.log('\nRe-run with --yes to apply.');
    return;
  }

  await assertEmulatorRunning();
  const db = getDb();
  const updatedBy = `cli:${env.PUBLISHER_EMAIL}`;

  const [accessBefore, adminsBefore] = await Promise.all([
    db.doc('config/access').get(),
    db.doc('config/admins').get(),
  ]);

  console.log('\nconfig/access');
  console.log(
    `  allowedDomains:       ${JSON.stringify(accessBefore.data()?.allowedDomains ?? null)} -> ${JSON.stringify(domains)}`,
  );
  console.log(
    `  allowExternalSharing: ${JSON.stringify(accessBefore.data()?.allowExternalSharing ?? null)} -> ${allowExternalSharing}`,
  );
  console.log('config/admins');
  console.log(
    `  emails:                ${JSON.stringify(adminsBefore.data()?.emails ?? null)} -> ${JSON.stringify(admins)}`,
  );

  await db.doc('config/access').set({
    allowedDomains: domains,
    allowExternalSharing,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  });
  await db.doc('config/admins').set({
    emails: admins,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  });

  console.log('\n✓ Wrote config/access and config/admins');
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
