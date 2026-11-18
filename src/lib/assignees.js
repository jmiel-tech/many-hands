// Group tasks: who holds a task. A task is held by one person, by a group, or by nobody.
//
// Stored as two fields that always agree:
//   assigneeIds: every holder, in order (empty when nobody holds it)
//   assigneeId:  the first holder, or null. Kept so tasks saved before group tasks
//                (which have no assigneeIds) and anything that only asks
//                "does someone hold this?" keep working.

export const GROUP_MAX = 10;

export function holderIds(task) {
  if (!task) return [];
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length) return task.assigneeIds;
  return task.assigneeId ? [task.assigneeId] : [];
}

export const holds = (task, uid) => Boolean(uid) && holderIds(task).includes(uid);

export const isGroupTask = (task) => holderIds(task).length > 1;

// The fields to write for a set of holders. Every write that changes who holds a task uses this,
// so assigneeId and assigneeIds never disagree.
export function assigneeFields(ids) {
  const clean = [...new Set((ids || []).filter(Boolean))];
  return { assigneeId: clean[0] ?? null, assigneeIds: clean };
}

// "Sam", "Sam and Alex", "Sam, Alex and Jo".
export function joinNames(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// Holder names with the viewer first: "you", "Sam", "you and Sam", "you, Sam and Alex".
export function holderNames(task, uid, nameOf) {
  const ids = holderIds(task);
  const others = ids.filter((id) => id !== uid).map(nameOf);
  return joinNames(ids.includes(uid) ? ['you', ...others] : others);
}
