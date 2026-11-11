// Firestore security rules tests. Run with: npm run test:rules
// (starts the Firestore emulator; needs Java 21 or newer).
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

let env;
const when = Timestamp.fromDate(new Date('2026-01-01'));

const asUser = (id) => env.authenticatedContext(id, { email: `${id}@example.com` }).firestore();
const signedOut = () => env.unauthenticatedContext().firestore();

const member = (id, extra = {}) => ({
  name: id,
  email: `${id}@example.com`,
  phone: '555-0100',
  createdAt: serverTimestamp(),
  ...extra,
});
const issue = (ownerId, extra = {}) => ({
  title: 'Food drive',
  description: 'Saturday',
  status: 'open',
  ownerId,
  createdAt: serverTimestamp(),
  ...extra,
});
const task = (createdBy, assigneeId, extra = {}) => ({
  issueId: 'issue1',
  title: 'Bring coffee',
  description: '',
  status: 'todo',
  assigneeId,
  createdBy,
  createdAt: serverTimestamp(),
  ...extra,
});
const comment = (authorId, extra = {}) => ({
  taskId: 'assigned',
  authorId,
  text: 'Thanks!',
  createdAt: serverTimestamp(),
  ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-many-hands',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

// Seed: alice owns issue1 and comment1, alice holds task "assigned", task "open" is unclaimed.
// root and root2 are admins.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'members/alice'), member('alice', { createdAt: when }));
    await setDoc(doc(db, 'members/bob'), member('bob', { createdAt: when }));
    await setDoc(doc(db, 'issues/issue1'), issue('alice', { createdAt: when }));
    await setDoc(doc(db, 'tasks/assigned'), task('alice', 'alice', { createdAt: when }));
    await setDoc(doc(db, 'tasks/open'), task('alice', null, { createdAt: when }));
    await setDoc(doc(db, 'comments/comment1'), comment('alice', { createdAt: when }));
    await setDoc(doc(db, 'members/root'), member('root', { createdAt: when }));
    await setDoc(doc(db, 'members/root2'), member('root2', { createdAt: when }));
    await setDoc(doc(db, 'admins/root'), {});
    await setDoc(doc(db, 'admins/root2'), {});
  });
});

// ---- signed-out access ----
for (const path of ['members/alice', 'issues/issue1', 'tasks/open', 'comments/comment1']) {
  test(`signed-out user cannot read ${path}`, async () => {
    await assertFails(getDoc(doc(signedOut(), path)));
  });
  test(`signed-in user can read ${path}`, async () => {
    await assertSucceeds(getDoc(doc(asUser('bob'), path)));
  });
}

// ---- members ----
test('member can create their own doc', async () => {
  await assertSucceeds(setDoc(doc(asUser('carol'), 'members/carol'), member('carol')));
});
test('member cannot create a doc under another uid', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'members/carol'), member('carol', { email: 'bob@example.com' })));
});
test('member doc must use the login email on create', async () => {
  await assertFails(setDoc(doc(asUser('carol'), 'members/carol'), member('carol', { email: 'alice@example.com' })));
});
test('owner can update their profile', async () => {
  await assertSucceeds(updateDoc(doc(asUser('alice'), 'members/alice'), { phone: '555-0199' }));
});
test('non-owner cannot update a profile', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'members/alice'), { phone: '555-0199' }));
});
test('profile email cannot be set to something other than the login email', async () => {
  await assertFails(updateDoc(doc(asUser('alice'), 'members/alice'), { email: 'bob@example.com' }));
});
test('owner can delete their profile, non-owner cannot', async () => {
  await assertFails(deleteDoc(doc(asUser('bob'), 'members/alice')));
  await assertSucceeds(deleteDoc(doc(asUser('alice'), 'members/alice')));
});
test('member validation: missing field, extra field, and too-long name fail', async () => {
  const db = asUser('carol');
  const { phone, ...noPhone } = member('carol');
  await assertFails(setDoc(doc(db, 'members/carol'), noPhone));
  await assertFails(setDoc(doc(db, 'members/carol'), member('carol', { admin: true })));
  await assertFails(setDoc(doc(db, 'members/carol'), member('carol', { name: 'x'.repeat(81) })));
});

// ---- issues ----
test('anyone signed in can create an issue they own', async () => {
  await assertSucceeds(setDoc(doc(asUser('bob'), 'issues/new'), issue('bob')));
});
test('cannot create an issue owned by someone else', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'issues/new'), issue('alice')));
});
test('owner can update an issue', async () => {
  await assertSucceeds(updateDoc(doc(asUser('alice'), 'issues/issue1'), { status: 'resolved' }));
});
test('non-owner cannot update an issue', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'issues/issue1'), { status: 'resolved' }));
});
test('owner cannot change ownerId', async () => {
  await assertFails(updateDoc(doc(asUser('alice'), 'issues/issue1'), { ownerId: 'bob' }));
});
test('issue validation: bad status and too-long title fail', async () => {
  const db = asUser('alice');
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { status: 'closed' }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { title: 'x'.repeat(121) }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { title: '' }));
});
test('owner can delete an issue, non-owner cannot', async () => {
  await assertFails(deleteDoc(doc(asUser('bob'), 'issues/issue1')));
  await assertSucceeds(deleteDoc(doc(asUser('alice'), 'issues/issue1')));
});

// ---- tasks ----
test('any member can create a task on any issue, assigned to anyone or no one', async () => {
  const db = asUser('bob');
  await assertSucceeds(setDoc(doc(db, 'tasks/t1'), task('bob', 'alice')));
  await assertSucceeds(setDoc(doc(db, 'tasks/t2'), task('bob', null)));
});
test('createdBy must be the current user', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'tasks/t1'), task('alice', null)));
});
test('a task cannot point at a missing issue or a missing member', async () => {
  const db = asUser('bob');
  await assertFails(setDoc(doc(db, 'tasks/t1'), task('bob', null, { issueId: 'nope' })));
  await assertFails(setDoc(doc(db, 'tasks/t1'), task('bob', 'ghost')));
});
test('assignee can edit, change status, and reassign', async () => {
  const db = asUser('alice');
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { title: 'New title', status: 'doing' }));
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { assigneeId: 'bob' }));
});
test('non-assignee cannot edit, reassign, or take over an assigned task', async () => {
  const db = asUser('bob');
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { title: 'Hacked' }));
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { status: 'done' }));
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { assigneeId: 'bob' }));
});
test('claim: any member can take an unassigned task', async () => {
  await assertSucceeds(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'bob' }));
});
test('claim: cannot assign an unassigned task to someone else', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'alice' }));
});
test('claim: cannot change any other field in the same write', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'bob', title: 'Mine now' }));
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'bob', status: 'done' }));
});
test('an unassigned task cannot be edited without claiming it', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/open'), { title: 'Edited' }));
  await assertFails(updateDoc(doc(asUser('alice'), 'tasks/open'), { title: 'Even the creator' }));
});
test('a second person cannot claim a task that was just taken', async () => {
  await assertSucceeds(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'bob' }));
  await assertFails(updateDoc(doc(asUser('alice'), 'tasks/open'), { assigneeId: 'alice' }));
});
test('issueId cannot change', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'issues/issue2'), issue('alice', { createdAt: when }));
  });
  await assertFails(updateDoc(doc(asUser('alice'), 'tasks/assigned'), { issueId: 'issue2' }));
});
test('task validation: bad status and removed required field fail', async () => {
  const db = asUser('alice');
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { status: 'blocked' }));
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { description: deleteField() }));
});
test('assignee can delete; non-assignee and unassigned deletes fail', async () => {
  await assertFails(deleteDoc(doc(asUser('bob'), 'tasks/assigned')));
  await assertFails(deleteDoc(doc(asUser('alice'), 'tasks/open')));
  await assertSucceeds(deleteDoc(doc(asUser('alice'), 'tasks/assigned')));
});

// ---- comments ----
test('any member can comment as themselves', async () => {
  await assertSucceeds(setDoc(doc(asUser('bob'), 'comments/c2'), comment('bob')));
});
test('cannot comment as someone else', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'comments/c2'), comment('alice')));
});
test('comments must be on a task that exists', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'comments/c2'), comment('bob', { taskId: 'issue1' })));
});
test('author can update a comment', async () => {
  await assertSucceeds(updateDoc(doc(asUser('alice'), 'comments/comment1'), { text: 'Edited' }));
});
test('non-author cannot update a comment', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'comments/comment1'), { text: 'Hacked' }));
});
test('taskId and authorId cannot change', async () => {
  const db = asUser('alice');
  await assertFails(updateDoc(doc(db, 'comments/comment1'), { taskId: 'open' }));
  await assertFails(updateDoc(doc(db, 'comments/comment1'), { authorId: 'bob' }));
});
test('comment validation: empty and too-long text fail', async () => {
  const db = asUser('alice');
  await assertFails(updateDoc(doc(db, 'comments/comment1'), { text: '' }));
  await assertFails(updateDoc(doc(db, 'comments/comment1'), { text: 'x'.repeat(2001) }));
});
test('author can delete a comment, non-author cannot', async () => {
  await assertFails(deleteDoc(doc(asUser('bob'), 'comments/comment1')));
  await assertSucceeds(deleteDoc(doc(asUser('alice'), 'comments/comment1')));
});

// ---- admins ----
const ban = (by, extra = {}) => ({ name: 'Alice', email: 'alice@example.com', bannedBy: by, createdAt: serverTimestamp(), ...extra });

test('nobody can make themselves an admin from the app', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'admins/bob'), {}));
  await assertFails(setDoc(doc(asUser('root'), 'admins/bob'), {}));
  await assertFails(deleteDoc(doc(asUser('root'), 'admins/root2')));
});
test('admin can edit and delete an issue they did not create, but not change its owner', async () => {
  const db = asUser('root');
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { title: 'Renamed', status: 'resolved' }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { ownerId: 'root' }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { status: 'closed' }));
  await assertSucceeds(deleteDoc(doc(db, 'issues/issue1')));
});
test('admin can delete any task and release a held one, but not edit or reassign it', async () => {
  const db = asUser('root');
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { title: 'Edited' }));
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { assigneeId: 'bob' }));
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { assigneeId: null }));
  await assertSucceeds(deleteDoc(doc(db, 'tasks/assigned')));
});
test('non-admins still cannot release or delete tasks they do not hold', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/assigned'), { assigneeId: null }));
  await assertFails(deleteDoc(doc(asUser('bob'), 'tasks/assigned')));
});
test('admin can kick a member: ban, free their tasks, and delete their profile in one batch', async () => {
  const db = asUser('root');
  const batch = writeBatch(db);
  batch.set(doc(db, 'bans/alice'), ban('root'));
  batch.update(doc(db, 'tasks/assigned'), { assigneeId: null });
  batch.delete(doc(db, 'members/alice'));
  await assertSucceeds(batch.commit());
});
test('non-admin cannot ban or delete another member', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'bans/alice'), ban('bob')));
  await assertFails(deleteDoc(doc(asUser('bob'), 'members/alice')));
});
test('admin cannot ban themselves or another admin, or ban in someone else\'s name', async () => {
  const db = asUser('root');
  await assertFails(setDoc(doc(db, 'bans/root'), ban('root')));
  await assertFails(setDoc(doc(db, 'bans/root2'), ban('root')));
  await assertFails(deleteDoc(doc(db, 'members/root2')));
  await assertFails(setDoc(doc(db, 'bans/alice'), ban('root2')));
});
test('ban list is readable by admins and by the banned person only', async () => {
  await assertSucceeds(setDoc(doc(asUser('root'), 'bans/alice'), ban('root')));
  await assertSucceeds(getDoc(doc(asUser('root2'), 'bans/alice')));
  await assertSucceeds(getDoc(doc(asUser('alice'), 'bans/alice')));
  await assertFails(getDoc(doc(asUser('bob'), 'bans/alice')));
});

// ---- banned members ----
test('a banned member is locked out of reading and writing everything', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'bans/alice'), { name: 'Alice', email: 'alice@example.com', bannedBy: 'root', createdAt: when });
  });
  const db = asUser('alice');
  for (const path of ['members/bob', 'issues/issue1', 'tasks/open', 'comments/comment1']) {
    await assertFails(getDoc(doc(db, path)));
  }
  await assertFails(setDoc(doc(db, 'issues/new'), issue('alice')));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { status: 'resolved' }));
  await assertFails(updateDoc(doc(db, 'tasks/open'), { assigneeId: 'alice' }));
  await assertFails(setDoc(doc(db, 'comments/c2'), comment('alice')));
  await assertFails(deleteDoc(doc(db, 'members/alice')));
  await assertFails(setDoc(doc(db, 'bans/alice'), ban('alice')));
  await assertFails(deleteDoc(doc(db, 'bans/alice')));
});
test('a banned member cannot sign up again with a fresh profile', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'members/alice'));
    await setDoc(doc(ctx.firestore(), 'bans/alice'), { name: 'Alice', email: 'alice@example.com', bannedBy: 'root', createdAt: when });
  });
  await assertFails(setDoc(doc(asUser('alice'), 'members/alice'), member('alice')));
});
test('after an admin lifts the ban, the member can set up a profile again', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'members/alice'));
    await setDoc(doc(ctx.firestore(), 'bans/alice'), { name: 'Alice', email: 'alice@example.com', bannedBy: 'root', createdAt: when });
  });
  await assertSucceeds(deleteDoc(doc(asUser('root'), 'bans/alice')));
  await assertSucceeds(setDoc(doc(asUser('alice'), 'members/alice'), member('alice')));
});
