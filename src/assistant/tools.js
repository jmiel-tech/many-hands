// What the assistant can do, and only through the app's existing functions in src/lib/api.js.
// It acts as the signed-in member, so the Firestore rules still decide in the end. The checks here mirror
// those rules so the assistant can refuse up front, say why, and offer something the member can do instead.
import { addComment, deleteComment, takeTask, updateTask } from '../lib/api.js';

export const TASK_STATUS = { todo: 'To do', doing: 'Doing', done: 'Done' };
export const READ_TOOLS = new Set(['find_tasks']);
export const WRITE_TOOLS = new Set(['take_task', 'set_my_task_status', 'add_comment']);
const COMMENT_MAX = 2000;
const FIND_LIMIT = 15;

export function parseArgs(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// ctx: { uid, tasks, issues, nameOf }
const findTask = (ctx, id) => (typeof id === 'string' ? ctx.tasks.find((t) => t.id === id) : undefined);
const issueOf = (ctx, task) => ctx.issues.find((i) => i.id === task.issueId);
const holderName = (ctx, task) => (task.assigneeId === ctx.uid ? 'you' : task.assigneeId ? ctx.nameOf(task.assigneeId) : 'no one');
export const taskPath = (task) => `/issues/${task.issueId}/tasks/${task.id}`;

const commentInstead = (title, who) => ({
  label: `Leave ${who} a comment instead`,
  draft: `Comment on “${title}”: `,
});

// Read-only search over the data the app already loaded (the same live listeners every screen uses).
export function findTasks(args, ctx) {
  const query = typeof args?.query === 'string' ? args.query.trim().toLowerCase() : '';
  const scope = ['needs_someone', 'mine', 'all'].includes(args?.scope) ? args.scope : 'all';
  const status = TASK_STATUS[args?.status] ? args.status : null;
  const rows = [];
  for (const task of ctx.tasks) {
    const issue = issueOf(ctx, task);
    if (!issue) continue; // left behind by a deleted issue; nobody can open it
    if (scope === 'needs_someone' && (task.assigneeId || task.status === 'done')) continue;
    if (scope === 'mine' && task.assigneeId !== ctx.uid) continue;
    if (status && task.status !== status) continue;
    const text = `${task.title} ${task.description || ''} ${issue.title}`.toLowerCase();
    if (query && !text.includes(query)) continue;
    rows.push({
      task_id: task.id,
      title: task.title,
      issue: issue.title,
      status: TASK_STATUS[task.status],
      held_by: holderName(ctx, task),
    });
  }
  return { count: rows.length, tasks: rows.slice(0, FIND_LIMIT) };
}

// Turns a proposed action into a card: { status: 'pending', ... } or { status: 'refused', reason, alternative }.
export function planAction(name, rawArgs, ctx) {
  const args = parseArgs(rawArgs);
  const refuse = (reason, alternative = null) => ({ status: 'refused', reason, alternative });
  if (!args) return refuse("I couldn't read that request. Try asking again in different words.");

  const task = findTask(ctx, args.task_id);
  if (!task) return refuse("I can't find that task. It may have been deleted.");
  if (!issueOf(ctx, task)) return refuse("That task's issue was deleted, so it can't be changed any more.");
  const base = { taskId: task.id, issueId: task.issueId, title: task.title };
  const holder = task.assigneeId ? ctx.nameOf(task.assigneeId) : null;

  if (name === 'take_task') {
    if (task.assigneeId === ctx.uid) return refuse(`“${task.title}” is already yours.`);
    if (task.assigneeId) {
      return refuse(
        `${holder} already holds “${task.title}”. Only the person holding a task can change it.`,
        commentInstead(task.title, holder.split(' ')[0]),
      );
    }
    return {
      ...base,
      status: 'pending',
      kind: 'take',
      summary: `Take “${task.title}”?`,
      detail: "It will be assigned to you, and you'll be the only one who can change it.",
    };
  }

  if (name === 'set_my_task_status') {
    const next = args.status;
    if (!TASK_STATUS[next]) return refuse('That isn\'t a status I know. Tasks can be To do, Doing or Done.');
    if (!task.assigneeId) {
      return refuse(
        `Nobody holds “${task.title}” yet. Only the person who takes a task can change its status.`,
        { label: 'Take it first', draft: `Take “${task.title}”` },
      );
    }
    if (task.assigneeId !== ctx.uid) {
      return refuse(
        `Only ${holder} can change “${task.title}”, because they hold it.`,
        commentInstead(task.title, holder.split(' ')[0]),
      );
    }
    if (task.status === next) return refuse(`“${task.title}” is already ${TASK_STATUS[next]}.`);
    return {
      ...base,
      status: 'pending',
      kind: 'status',
      next,
      summary: `Mark “${task.title}” as ${TASK_STATUS[next]}?`,
      detail: `It's ${TASK_STATUS[task.status]} now.`,
    };
  }

  if (name === 'add_comment') {
    const text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text) return refuse('A comment needs some text.');
    if (text.length > COMMENT_MAX) return refuse(`Comments can be up to ${COMMENT_MAX} characters.`);
    return {
      ...base,
      status: 'pending',
      kind: 'comment',
      text,
      summary: `Comment on “${task.title}”?`,
      detail: text,
    };
  }

  return refuse("That's not something I can do. You can do it from the task or issue screen.");
}

// Runs a confirmed action. Checks again first, because the task may have changed since the card appeared.
export async function runAction(action, ctx) {
  const fresh = planAction(action.name, action.args, ctx);
  if (fresh.status !== 'pending') {
    throw Object.assign(new Error('refused'), { friendly: fresh.reason });
  }
  const task = findTask(ctx, action.taskId);
  if (action.kind === 'take') {
    await takeTask(task.id, ctx.uid);
    return { undo: { prevStatus: task.status }, done: `You took “${task.title}”.` };
  }
  if (action.kind === 'status') {
    await updateTask(task.id, { status: fresh.next });
    return { undo: { prevStatus: task.status }, done: `“${task.title}” is now ${TASK_STATUS[fresh.next]}.` };
  }
  if (action.kind === 'comment') {
    const commentId = await addComment(ctx.uid, task.id, fresh.text);
    return { undo: { commentId }, done: `Comment posted on “${task.title}”.` };
  }
  throw new Error('unknown action');
}

// Undo, also through the existing functions: the same calls as "Give it back", the status control, and deleting a comment.
export async function undoAction(action) {
  const { kind, taskId, undo } = action;
  if (kind === 'take') await updateTask(taskId, { assigneeId: null, status: undo.prevStatus });
  else if (kind === 'status') await updateTask(taskId, { status: undo.prevStatus });
  else if (kind === 'comment') await deleteComment(undo.commentId);
  else throw new Error('unknown action');
}
