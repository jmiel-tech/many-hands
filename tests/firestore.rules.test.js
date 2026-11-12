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
  phone: '(555) 555-0100',
  createdAt: serverTimestamp(),
  ...extra,
});
const issue = (ownerId, extra = {}) => ({
  title: 'Food drive',
  description: 'Saturday',
  status: 'open',
  ownerId,
  editorIds: [ownerId],
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
  await assertSucceeds(updateDoc(doc(asUser('alice'), 'members/alice'), { phone: '(555) 555-0199' }));
});
test('non-owner cannot update a profile', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'members/alice'), { phone: '(555) 555-0199' }));
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
test('member phone must be a 10-digit number in (555) 123-4567 format', async () => {
  const db = asUser('carol');
  await assertFails(setDoc(doc(db, 'members/carol'), member('carol', { phone: '555-0100' })));
  await assertFails(setDoc(doc(db, 'members/carol'), member('carol', { phone: '5551234567' })));
  await assertFails(setDoc(doc(db, 'members/carol'), member('carol', { phone: '(555) 123-45678' })));
  await assertSucceeds(setDoc(doc(db, 'members/carol'), member('carol', { phone: '(555) 123-4567' })));
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
test('non-owner without edit access cannot update an issue', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'issues/issue1'), { status: 'resolved' }));
});
test('owner cannot change ownerId', async () => {
  await assertFails(updateDoc(doc(asUser('alice'), 'issues/issue1'), { ownerId: 'bob' }));
});
test('owner can grant and revoke edit access', async () => {
  const db = asUser('alice');
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { editorIds: ['alice', 'bob'] }));
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { editorIds: ['alice'] }));
});
test('owner cannot remove their own edit access', async () => {
  await assertFails(updateDoc(doc(asUser('alice'), 'issues/issue1'), { editorIds: ['bob'] }));
});
test('an editor can change issue content but not permissions, and cannot delete', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'issues/issue1'), { editorIds: ['alice', 'bob'] });
  });
  const db = asUser('bob');
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { status: 'resolved', title: 'Renamed' }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { editorIds: ['alice', 'bob', 'carol'] }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { editorIds: ['alice'] }));
  await assertFails(deleteDoc(doc(db, 'issues/issue1')));
});
test('issue must list the owner as an editor', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'issues/new'), issue('bob', { editorIds: [] })));
  await assertFails(setDoc(doc(asUser('bob'), 'issues/new'), issue('bob', { editorIds: ['alice'] })));
});
test('issue validation: bad status and too-long title fail', async () => {
  const db = asUser('alice');
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { status: 'closed' }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { title: 'x'.repeat(121) }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { title: '' }));
});
test('issue dueDate: can be created with a date or null; malformed values fail', async () => {
  const db = asUser('bob');
  await assertSucceeds(setDoc(doc(db, 'issues/i1'), issue('bob', { dueDate: '2026-11-15' })));
  await assertSucceeds(setDoc(doc(db, 'issues/i2'), issue('bob', { dueDate: null })));
  await assertFails(setDoc(doc(db, 'issues/i3'), issue('bob', { dueDate: 'Nov 15' })));
  await assertFails(setDoc(doc(db, 'issues/i4'), issue('bob', { dueDate: when })));
});
test('issue dueDate: an issue without it can still be updated, and the owner can set and clear it', async () => {
  const db = asUser('alice');
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { status: 'in_progress' }));
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { dueDate: '2026-11-15' }));
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { dueDate: null }));
});
test('issue dueDate: an editor can set and clear it, even on an issue that never had one', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'issues/issue1'), { editorIds: ['alice', 'bob'] });
  });
  const db = asUser('bob');
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { title: 'Renamed', dueDate: null }));
  await assertSucceeds(updateDoc(doc(db, 'issues/issue1'), { dueDate: '2026-11-15' }));
  await assertFails(updateDoc(doc(db, 'issues/issue1'), { dueDate: 'soon' }));
});
test('issue dueDate: a non-owner cannot set it, and unknown fields still fail', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'issues/issue1'), { dueDate: '2026-11-15' }));
  await assertFails(updateDoc(doc(asUser('alice'), 'issues/issue1'), { priority: 'high' }));
});
test('owner can delete an issue, non-owner cannot', async () => {
  await assertFails(deleteDoc(doc(asUser('bob'), 'issues/issue1')));
  await assertSucceeds(deleteDoc(doc(asUser('alice'), 'issues/issue1')));
});

// ---- tasks ----
test('the owner can create a task on their issue, assigned to anyone or no one', async () => {
  const db = asUser('alice');
  await assertSucceeds(setDoc(doc(db, 'tasks/t1'), task('alice', 'bob')));
  await assertSucceeds(setDoc(doc(db, 'tasks/t2'), task('alice', null)));
});
test('a user without edit access cannot create a task', async () => {
  await assertFails(setDoc(doc(asUser('bob'), 'tasks/t1'), task('bob', null)));
});
test('an editor can create a task', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'issues/issue1'), { editorIds: ['alice', 'bob'] });
  });
  await assertSucceeds(setDoc(doc(asUser('bob'), 'tasks/t1'), task('bob', 'alice')));
});
test('createdBy must be the current user', async () => {
  await assertFails(setDoc(doc(asUser('alice'), 'tasks/t1'), task('bob', null)));
});
test('a task cannot point at a missing issue or a missing member', async () => {
  const db = asUser('alice');
  await assertFails(setDoc(doc(db, 'tasks/t1'), task('alice', null, { issueId: 'nope' })));
  await assertFails(setDoc(doc(db, 'tasks/t1'), task('alice', 'ghost')));
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
test('task validation: an unknown extra field fails', async () => {
  await assertFails(setDoc(doc(asUser('alice'), 'tasks/t1'), task('alice', null, { priority: 'high' })));
  await assertFails(updateDoc(doc(asUser('alice'), 'tasks/assigned'), { priority: 'high' }));
});

// ---- task due dates (seeded tasks have no dueDate, like tasks made before the field existed) ----
test('dueDate: a task can be created with a date or with null', async () => {
  const db = asUser('alice');
  await assertSucceeds(setDoc(doc(db, 'tasks/t1'), task('alice', null, { dueDate: '2026-11-15' })));
  await assertSucceeds(setDoc(doc(db, 'tasks/t2'), task('alice', 'bob', { dueDate: null })));
});
test('dueDate: malformed values fail', async () => {
  const db = asUser('alice');
  await assertFails(setDoc(doc(db, 'tasks/t1'), task('alice', null, { dueDate: 'Nov 15' })));
  await assertFails(setDoc(doc(db, 'tasks/t2'), task('alice', null, { dueDate: 20261115 })));
  await assertFails(setDoc(doc(db, 'tasks/t3'), task('alice', null, { dueDate: when })));
  await assertFails(setDoc(doc(db, 'tasks/t4'), task('alice', null, { dueDate: '2026-11-15T00:00' })));
});
test('dueDate: a task without the field can still be claimed and updated', async () => {
  await assertSucceeds(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'bob' }));
  await assertSucceeds(updateDoc(doc(asUser('bob'), 'tasks/open'), { status: 'doing' }));
  await assertSucceeds(updateDoc(doc(asUser('alice'), 'tasks/assigned'), { status: 'done' }));
});
test('dueDate: the assignee can set, change and clear it', async () => {
  const db = asUser('alice');
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { dueDate: '2026-11-15' }));
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { dueDate: '2026-12-01' }));
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { dueDate: null }));
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { dueDate: deleteField() }));
});
test('dueDate: a non-assignee cannot set it, and a claim cannot set it', async () => {
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/assigned'), { dueDate: '2026-11-15' }));
  await assertFails(updateDoc(doc(asUser('bob'), 'tasks/open'), { assigneeId: 'bob', dueDate: '2026-11-15' }));
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
// A ban must hold an exact copy of the member's profile (alice's seeded profile here).
const ban = (by, extra = {}) => ({ name: 'alice', email: 'alice@example.com', phone: '(555) 555-0100', memberCreatedAt: when, bannedBy: by, createdAt: serverTimestamp(), ...extra });
const savedBan = { name: 'alice', email: 'alice@example.com', phone: '(555) 555-0100', memberCreatedAt: when, bannedBy: 'root', createdAt: when };

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
    await setDoc(doc(ctx.firestore(), 'bans/alice'), savedBan);
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
    await setDoc(doc(ctx.firestore(), 'bans/alice'), savedBan);
  });
  await assertFails(setDoc(doc(asUser('alice'), 'members/alice'), member('alice')));
});
test('after an admin lifts the ban, the member can set up a profile again', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'members/alice'));
    await setDoc(doc(ctx.firestore(), 'bans/alice'), savedBan);
  });
  await assertSucceeds(deleteDoc(doc(asUser('root'), 'bans/alice')));
  await assertSucceeds(setDoc(doc(asUser('alice'), 'members/alice'), member('alice')));
});

// ---- letting someone back in ----
const restored = { name: 'alice', email: 'alice@example.com', phone: '(555) 555-0100', createdAt: when };
async function seedKickedAlice() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'members/alice'));
    await setDoc(doc(ctx.firestore(), 'bans/alice'), savedBan);
  });
}

test('kicking must save an exact copy of the profile in the ban', async () => {
  const db = asUser('root');
  await assertFails(setDoc(doc(db, 'bans/alice'), ban('root', { phone: '(555) 555-9999' })));
  await assertFails(setDoc(doc(db, 'bans/alice'), ban('root', { name: 'Someone else' })));
  await assertFails(setDoc(doc(db, 'bans/carol'), ban('root', { name: 'carol', email: 'carol@example.com' })));
});
test('admin lets a member back in: ban lifted and profile restored in one batch', async () => {
  await seedKickedAlice();
  const db = asUser('root');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bans/alice'));
  batch.set(doc(db, 'members/alice'), restored);
  await assertSucceeds(batch.commit());
  const snap = await getDoc(doc(asUser('bob'), 'members/alice'));
  if (snap.data().phone !== '(555) 555-0100') throw new Error('profile not restored');
});
test('admin cannot restore a profile without lifting the ban, or with changed details', async () => {
  await seedKickedAlice();
  const db = asUser('root');
  await assertFails(setDoc(doc(db, 'members/alice'), restored));
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bans/alice'));
  batch.set(doc(db, 'members/alice'), { ...restored, phone: '(555) 555-9999' });
  await assertFails(batch.commit());
});
test('non-admin cannot let someone back in', async () => {
  await seedKickedAlice();
  const db = asUser('bob');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bans/alice'));
  batch.set(doc(db, 'members/alice'), restored);
  await assertFails(batch.commit());
});
test('admin cannot create a profile for someone who was never banned', async () => {
  await assertFails(setDoc(doc(asUser('root'), 'members/carol'), { name: 'carol', email: 'carol@example.com', phone: '(555) 555-0100', createdAt: when }));
});

// ---- repeating tasks ----
test('a task can repeat daily, weekly, every 2 weeks, or monthly when it has a due date', async () => {
  const db = asUser('alice');
  for (const repeat of ['daily', 'weekly', 'biweekly', 'monthly']) {
    await assertSucceeds(setDoc(doc(db, `tasks/r-${repeat}`), task('alice', null, { dueDate: '2026-11-14', repeat })));
  }
  await assertSucceeds(setDoc(doc(db, 'tasks/r-none'), task('alice', null, { dueDate: '2026-11-14', repeat: null })));
});
test('repeat must be a known value and needs a due date', async () => {
  const db = asUser('alice');
  await assertFails(setDoc(doc(db, 'tasks/r1'), task('alice', null, { dueDate: '2026-11-14', repeat: 'yearly' })));
  await assertFails(setDoc(doc(db, 'tasks/r2'), task('alice', null, { dueDate: '2026-11-14', repeat: 7 })));
  await assertFails(setDoc(doc(db, 'tasks/r3'), task('alice', null, { repeat: 'weekly' })));
  await assertFails(setDoc(doc(db, 'tasks/r4'), task('alice', null, { dueDate: null, repeat: 'weekly' })));
});
test('the holder can turn repeating on and off, but not drop the due date while it repeats', async () => {
  const db = asUser('alice');
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { dueDate: '2026-11-14', repeat: 'weekly' }));
  await assertFails(updateDoc(doc(db, 'tasks/assigned'), { dueDate: null }));
  await assertSucceeds(updateDoc(doc(db, 'tasks/assigned'), { repeat: null }));
});
test('finishing a repeating task: mark it done and create the next one in one batch', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'tasks/weekly'), task('bob', 'alice', { createdAt: when, dueDate: '2026-11-14', repeat: 'weekly' }));
  });
  const db = asUser('alice');
  const batch = writeBatch(db);
  batch.update(doc(db, 'tasks/weekly'), { status: 'done', repeat: null });
  batch.set(doc(db, 'tasks/weekly-next'), task('alice', null, { dueDate: '2026-11-21', repeat: 'weekly', repeatOf: 'weekly' }));
  await assertSucceeds(batch.commit());
});

// bob holds a weekly task on alice's issue, but has no edit access to that issue.
async function seedBobsWeeklyTask() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'tasks/weekly'), task('alice', 'bob', { createdAt: when, dueDate: '2026-11-14', repeat: 'weekly' }));
  });
}
const finishAndRepeat = (db, next = {}) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'tasks/weekly'), { status: 'done', repeat: null });
  batch.set(doc(db, 'tasks/weekly-next'), task('bob', null, { dueDate: '2026-11-21', repeat: 'weekly', repeatOf: 'weekly', ...next }));
  return batch.commit();
};

test('a holder without edit access can still finish a repeating task and start the next one', async () => {
  await seedBobsWeeklyTask();
  await assertSucceeds(finishAndRepeat(asUser('bob')));
});
test('without edit access, a follow-up is refused unless the old task is finished in the same batch', async () => {
  await seedBobsWeeklyTask();
  const db = asUser('bob');
  await assertFails(setDoc(doc(db, 'tasks/weekly-next'), task('bob', null, { dueDate: '2026-11-21', repeat: 'weekly', repeatOf: 'weekly' })));
  // Finishing it but leaving repeat on would let it start a second follow-up later.
  const batch = writeBatch(db);
  batch.update(doc(db, 'tasks/weekly'), { status: 'done' });
  batch.set(doc(db, 'tasks/weekly-next'), task('bob', null, { dueDate: '2026-11-21', repeat: 'weekly', repeatOf: 'weekly' }));
  await assertFails(batch.commit());
});
test('a follow-up must stay on the same issue and schedule, and start unclaimed', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'issues/issue2'), issue('alice', { createdAt: when }));
  });
  await seedBobsWeeklyTask();
  const db = asUser('bob');
  await assertFails(finishAndRepeat(db, { issueId: 'issue2' }));
  await assertFails(finishAndRepeat(db, { repeat: 'daily' }));
  await assertFails(finishAndRepeat(db, { assigneeId: 'bob' }));
  await assertFails(finishAndRepeat(db, { status: 'doing' }));
});
test('a finished task cannot start a second follow-up', async () => {
  await seedBobsWeeklyTask();
  const db = asUser('bob');
  await assertSucceeds(finishAndRepeat(db));
  await assertFails(setDoc(doc(db, 'tasks/weekly-again'), task('bob', null, { dueDate: '2026-11-28', repeat: 'weekly', repeatOf: 'weekly' })));
});
test('someone who never held the task cannot create its follow-up', async () => {
  await seedBobsWeeklyTask();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'members/carol'), member('carol', { createdAt: when }));
  });
  const db = asUser('carol');
  await assertFails(setDoc(doc(db, 'tasks/weekly-next'), task('carol', null, { dueDate: '2026-11-21', repeat: 'weekly', repeatOf: 'weekly' })));
});
test('someone who does not hold a repeating task cannot finish it or change its repeat', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'tasks/weekly'), task('bob', 'alice', { createdAt: when, dueDate: '2026-11-14', repeat: 'weekly' }));
  });
  const db = asUser('bob');
  await assertFails(updateDoc(doc(db, 'tasks/weekly'), { status: 'done', repeat: null }));
  await assertFails(updateDoc(doc(db, 'tasks/weekly'), { repeat: 'daily' }));
});
