import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData, canEditIssue } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { createIssue, updateIssue } from '../lib/api.js';
import { EditorPicker } from './IssueAccess.jsx';
import { Avatar, ErrorNote, FormHead, ISSUE_STATUS, LockNote, Modal, Segmented, firstName } from '../components/ui.jsx';

export default function IssueForm() {
  const { issueId } = useParams();
  const { user, member } = useAuth();
  const { issues, members, nameOf } = useData();
  const navigate = useNavigate();
  const issue = issues.find((i) => i.id === issueId);
  const isEdit = Boolean(issueId);
  const isOwner = !isEdit || issue?.ownerId === user.uid;
  const [title, setTitle] = useState(issue?.title || '');
  const [description, setDescription] = useState(issue?.description || '');
  const [status, setStatus] = useState(issue?.status || 'open');
  const [dueDate, setDueDate] = useState(issue?.dueDate || '');
  const [editorIds, setEditorIds] = useState(() => (issue?.editorIds || []).filter((id) => id !== issue?.ownerId));
  const { busy, error, run } = useAction();

  const close = () => navigate(isEdit ? `/issues/${issueId}` : '/issues');

  if (isEdit && !canEditIssue(issue, user.uid)) {
    return (
      <Modal title="Edit issue" onClose={close}>
        <FormHead title="Not yours to edit." />
        <div className="form"><LockNote>Only {firstName(nameOf(issue?.ownerId))} and people they've given edit access can edit this issue.</LockNote></div>
      </Modal>
    );
  }

  const others = members.filter((m) => m.id !== (issue?.ownerId ?? user.uid));
  const toggleEditor = (id) => setEditorIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = (e) => {
    e.preventDefault();
    const values = { title: title.trim(), description: description.trim(), status, dueDate: dueDate || null };
    run(async () => {
      if (isEdit) {
        // Only the owner can change who has edit access.
        await updateIssue(issueId, isOwner ? { ...values, editorIds: [issue.ownerId, ...editorIds] } : values);
        close();
      } else {
        const id = await createIssue(user.uid, { ...values, editorIds: [user.uid, ...editorIds] });
        navigate(`/issues/${id}`);
      }
    });
  };

  return (
    <Modal title={isEdit ? 'Edit issue' : 'New issue'} onClose={close}>
      <FormHead
        title={isEdit ? 'Edit issue.' : 'New issue.'}
        subtitle={isEdit ? (isOwner ? "You started this one, so it's yours to change." : 'The owner gave you edit access to this one.') : 'Start something the group can pitch in on.'}
      />
      <form className="form" aria-label={isEdit ? 'Edit issue' : 'New issue'} onSubmit={submit}>
        <label className="lbl">Title
          <input className="field" type="text" required maxLength={120} placeholder="e.g. Spring Coat Drive" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="lbl">Description
          <textarea className="field" rows={4} maxLength={2000} placeholder="What's this about? Where?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="lbl">Due date
          <input className="field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <span className="hint">
            Optional.{' '}
            {dueDate && <button type="button" className="textlink small" onClick={() => setDueDate('')}>Clear date</button>}
          </span>
        </label>
        <Segmented label="Status" name="issue-status" options={ISSUE_STATUS} value={status} onChange={setStatus} />
        {isOwner && others.length > 0 && <EditorPicker people={others} selected={editorIds} onToggle={toggleEditor} />}
        <div className="note-row">
          <Avatar id={issue?.ownerId ?? user.uid} name={isOwner ? member.name : nameOf(issue.ownerId)} size={36} />
          <span><strong>Owner: {isOwner ? `${member.name} (you)` : nameOf(issue.ownerId)}.</strong> Everyone can read this issue. Only the owner and people with edit access can edit it or add tasks. Only the owner can delete it.</span>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="pill pill-lg" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create issue'}
        </button>
      </form>
    </Modal>
  );
}
