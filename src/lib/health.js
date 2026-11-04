// Issue health, computed client-side from an issue's tasks. Text is always shown, never color alone.
export function issueHealth(tasks) {
  const total = tasks.length;
  const unassigned = tasks.filter((t) => !t.assigneeId).length;
  const assigned = total - unassigned;
  let label;
  if (total === 0) label = 'Orphaned';
  else if (unassigned === 0) label = 'Covered';
  else if (unassigned > total / 2) label = 'At risk';
  else label = 'Thin';
  return { label, total, assigned, unassigned };
}

// Unclaimed wins over status: a task nobody holds still needs someone.
export function groupTasks(tasks) {
  const groups = { unclaimed: [], todo: [], doing: [], done: [] };
  for (const task of tasks) {
    if (!task.assigneeId) groups.unclaimed.push(task);
    else groups[task.status]?.push(task);
  }
  return groups;
}

export function healthSentence({ label, unassigned }) {
  if (label === 'Orphaned') return 'No tasks yet. Add the first one.';
  if (label === 'Covered') return 'Every task has someone.';
  const left = `${unassigned} still ${unassigned === 1 ? 'needs' : 'need'} a person.`;
  return label === 'At risk' ? `Most tasks need someone. ${left}` : `Many tasks have someone. ${left}`;
}
