import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData, canEditIssue } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { createTask, saveTask } from '../lib/api.js';
import { REPEAT_OPTIONS, formatDue, nextDueDate } from '../lib/dates.js';
import { Avatar, ErrorNote, FormHead, LockNote, Modal, Segmented, TASK_STATUS, firstName } from '../components/ui.jsx';

export default function TaskForm() {
  const { issueId: routeIssueId, taskId } = useParams();
  const { user } = useAuth();
  const { tasks, issues, members, nameOf } = useData();
  const navigate = useNavigate();
  const task = tasks.find((t) => t.id === taskId);
  const isEdit = Boolean(taskId);
  const [issueId, setIssueId] = useState(routeIssueId);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [repeat, setRepeat] = useState(task?.repeat || '');
  const { busy, error, setError, run } = useAction();

  const close = () => navigate(isEdit ? `/issues/${routeIssueId}/tasks/${taskId}` : `/issues/${routeIssueId}`);

  if (isEdit && task?.assigneeId !== user.uid) {
    return (
      <Modal title="Edit task" onClose={close}>
        <FormHead title="Not yours to edit." />
        <div className="form">
          <LockNote>
            {task?.assigneeId ? `Only ${firstName(nameOf(task.assigneeId))} can edit this task.` : 'Take this task first, then you can edit it.'}
          </LockNote>
        </div>
      </Modal>
    );
  }

  if (!isEdit && !canEditIssue(issues.find((i) => i.id === routeIssueId), user.uid)) {
    return (
      <Modal title="New task" onClose={close}>
        <FormHead title="Not yours to add to." />
        <div className="form"><LockNote>Only the issue's owner and people they've given edit access can add tasks to it.</LockNote></div>
      </Modal>
    );
  }

  // Me first, then everyone else.
  const people = [...members].sort((a, b) => (b.id === user.uid) - (a.id === user.uid));
  const editableIssues = issues.filter((i) => canEditIssue(i, user.uid));
  const unassigned = assigneeId === '';
  const holder = unassigned ? null : assigneeId === user.uid ? 'you' : firstName(nameOf(assigneeId));

  const submit = (e) => {
    e.preventDefault();
    if (repeat && !dueDate) {
      setError('A repeating task needs a due date, so the app knows when the next one is due.');
      return;
    }
    const values = {
      title: title.trim(),
      description: description.trim(),
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      repeat: (dueDate && repeat) || null,
      // A task nobody holds can't be underway.
      status: unassigned ? 'todo' : status,
    };
    run(async () => {
      // When a save finishes a repeating task, the panel says when the next one is due.
      if (isEdit) {
        const nextDue = await saveTask(user.uid, task, values);
        // Reassigning hands over control, so go back to the board's read-only view.
        navigate(`/issues/${routeIssueId}/tasks/${taskId}`, { state: { nextDue } });
      } else {
        const { id, nextDue } = await createTask(user.uid, { ...values, issueId });
        navigate(`/issues/${issueId}/tasks/${id}`, { state: { nextDue } });
      }
    });
  };

  return (
    <Modal title={isEdit ? 'Edit task' : 'New task'} onClose={close}>
      <FormHead
        title={isEdit ? 'Edit task.' : 'New task.'}
        subtitle={isEdit ? "It's assigned to you, so it's yours to change." : 'Add something the group needs done.'}
      />
      <form className="form" aria-label={isEdit ? 'Edit task' : 'New task'} onSubmit={submit}>
        {!isEdit && (
          <label className="lbl">Issue
            <select className="field select" value={issueId} onChange={(e) => setIssueId(e.target.value)}>
              {editableIssues.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </label>
        )}
        <label className="lbl">Title
          <input className="field" type="text" required maxLength={120} placeholder="e.g. Bring 2 folding tables" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="lbl">Description
          <textarea className="field" rows={4} maxLength={2000} placeholder="What does this involve? Where?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="lbl">Due date
          <input className="field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <span className="hint">
            Optional.{' '}
            {dueDate && <button type="button" className="textlink small" onClick={() => { setDueDate(''); setRepeat(''); }}>Clear date</button>}
          </span>
        </label>
        <label className="lbl">Repeat
          <select className="field select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            <option value="">Never</option>
            {Object.entries(REPEAT_OPTIONS).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
          <span className="hint">
            {!repeat
              ? 'Pick how often this comes around, and a new copy is made each time it\'s marked done.'
              : !dueDate
                ? 'Pick a due date above. The next one is counted from it.'
                : `When it's marked done, a new unclaimed copy is made, due ${formatDue(nextDueDate(dueDate, repeat))}.`}
          </span>
        </label>
        {!unassigned && (
          <Segmented label="Status" name="task-form-status" options={TASK_STATUS} value={status} onChange={setStatus} />
        )}
        <fieldset className="assign">
          <legend className="field-label">Assign to</legend>
          <div className="assign-list">
            <label className="assign-row">
              <input type="radio" name="assignee" checked={unassigned} onChange={() => setAssigneeId('')} />
              <span className="avatar avatar-none" aria-hidden="true">?</span>
              <span className="assign-name">Leave unassigned<small>Anyone can take it</small></span>
            </label>
            {people.map((p) => (
              <label className="assign-row" key={p.id}>
                <input type="radio" name="assignee" checked={assigneeId === p.id} onChange={() => setAssigneeId(p.id)} />
                <Avatar id={p.id} name={p.name} size={34} />
                <span className="assign-name">{p.name}{p.id === user.uid && <small>You</small>}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="note-box">
          {unassigned ? (
            'You can create a task for anyone. Whoever takes this one can then edit it, change its status, or delete it.'
          ) : (
            <>You can create a task for anyone. Once it's saved, only <strong>{holder}</strong> can edit it, change its status, or delete it.</>
          )}
        </p>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="pill pill-lg" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
        </button>
      </form>
    </Modal>
  );
}
