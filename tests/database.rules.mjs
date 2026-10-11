import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// Fail closed: this suite must never connect to a production database.
const projectId = 'demo-reader-privacy';
const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (emulator !== '127.0.0.1:9000') throw new Error('Run through npm run test:rules with the loopback Database Emulator.');
let env;
const root = 'horario_v5_state';
const allowed = ['SH', 'weeks/2026-10-05/schedule', 'weekRosters/2026-10-05'];
const privatePaths = ['', 'logEntries', 'EMPLOYEES', 'employeeCounter', 'customCounter', 'baseDate', 'weeks/2026-10-05/edited', 'weeks', 'weeks/2026-10-05', 'weekRosters', 'schemaVersion', 'other'];
const fixture = {
  SH: { OFF: { id: 'OFF', name: 'Free', start: 0, end: 0 } },
  weeks: { '2026-10-05': { schedule: [[{ id: 'OFF' }]], edited: [[true]] } },
  weekRosters: { '2026-10-05': [{ id: 'synthetic-1', name: 'Synthetic worker' }] },
  EMPLOYEES: [{ id: 'synthetic-1', name: 'Synthetic catalog' }],
  logEntries: [{ msg: 'Synthetic private activity' }], employeeCounter: 1, customCounter: 2,
  baseDate: '2026-10-05', schemaVersion: 2, other: 'private'
};
const path = child => `${root}${child ? `/${child}` : ''}`;
before(async () => {
  env = await initializeTestEnvironment({ projectId, database: { host: '127.0.0.1', port: 9000, rules: await readFile(new URL('../database.rules.json', import.meta.url), 'utf8') } });
  await env.withSecurityRulesDisabled(context => context.database().ref(root).set(fixture));
});
after(async () => { if (env) await env.cleanup(); });
for (const child of [...allowed, ...privatePaths]) {
  test(`unauthenticated read denied: ${path(child)}`, async () => {
    await assertFails(env.unauthenticatedContext().database().ref(path(child)).once('value'));
  });
}
for (const child of ['', ...allowed, 'logEntries']) {
  test(`unauthenticated write denied: ${path(child)}`, async () => {
    await assertFails(env.unauthenticatedContext().database().ref(path(child)).set(null));
  });
}
for (const [label, claims] of [
  ['worker', { email: 'worker@example.test', email_verified: false }],
  ['unverified admin email', { email: 'dilanarenis21@gmail.com', email_verified: false }],
  ['other verified email', { email: 'other@example.test', email_verified: true }],
  ['missing verified claim', { email: 'dilanarenis21@gmail.com' }]
]) {
  for (const child of allowed) {
    test(`${label} read allowed: ${path(child)}`, async () => {
      await assertSucceeds(env.authenticatedContext(label.replaceAll(' ', '-'), claims).database().ref(path(child)).once('value'));
    });
  }
  for (const child of privatePaths) {
    test(`${label} private read denied: ${path(child)}`, async () => {
      await assertFails(env.authenticatedContext(label.replaceAll(' ', '-'), claims).database().ref(path(child)).once('value'));
    });
  }
  for (const child of ['', ...allowed, 'logEntries', 'EMPLOYEES', 'weeks/2026-10-05/edited', 'other']) {
    test(`${label} write denied: ${path(child)}`, async () => {
      await assertFails(env.authenticatedContext(label.replaceAll(' ', '-'), claims).database().ref(path(child)).set(null));
    });
  }
}
test('verified admin reads and writes the full authoritative root', async () => {
  const db = env.authenticatedContext('verified-admin', { email: 'dilanarenis21@gmail.com', email_verified: true }).database();
  await assertSucceeds(db.ref(root).once('value'));
  await assertSucceeds(db.ref(root).set(fixture));
});
test('verified admin still cannot read or write an unrelated root', async () => {
  const db = env.authenticatedContext('verified-admin', { email: 'dilanarenis21@gmail.com', email_verified: true }).database();
  await assertFails(db.ref('unrelated').once('value'));
  await assertFails(db.ref('unrelated').set('denied'));
});
