import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { createIssue, updateIssue } from '../lib/api.js';
import { Avatar, ErrorNote, FormHead, ISSUE_STATUS, LockNote, Modal, Segmented, firstName } from '../components/ui.jsx';

export default function IssueForm() {
  const { issueId } = useParams();
  const { user, member } = useAuth();
  const { issues, nameOf } = useData();
  const navigate = useNavigate();
  const issue = issues.find((i) => i.id === issueId);
  const isEdit = Boolean(issueId);
  const [title, setTitle] = useState(issue?.title || '');
  const [description, setDescription] = useState(issue?.description || '');
  const [status, setStatus] = useState(issue?.status || 'open');
  const { busy, error, run } = useAction();

  const close = () => navigate(isEdit ? `/issues/${issueId}` : '/issues');

  if (isEdit && issue?.ownerId !== user.uid) {
    return (
      <Modal title="Edit issue" onClose={close}>
        <FormHead title="Not yours to edit." />
        <div className="form"><LockNote>Only {firstName(nameOf(issue?.ownerId))} can edit this issue.</LockNote></div>
      </Modal>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const values = { title: title.trim(), description: description.trim(), status };
    run(async () => {
      if (isEdit) {
        await updateIssue(issueId, values);
        close();
      } else {
        const id = await createIssue(user.uid, values);
        navigate(`/issues/${id}`);
      }
    });
  };

  return (
    <Modal title={isEdit ? 'Edit issue' : 'New issue'} onClose={close}>
      <FormHead
        title={isEdit ? 'Edit issue.' : 'New issue.'}
        subtitle={isEdit ? "You started this one, so it's yours to change." : 'Start something the group can pitch in on.'}
      />
      <form className="form" aria-label={isEdit ? 'Edit issue' : 'New issue'} onSubmit={submit}>
        <label className="lbl">Title
          <input className="field" type="text" required maxLength={120} placeholder="e.g. Spring Coat Drive" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="lbl">Description
          <textarea className="field" rows={4} maxLength={2000} placeholder="What's this about? Any dates or places?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <Segmented label="Status" name="issue-status" options={ISSUE_STATUS} value={status} onChange={setStatus} />
        <div className="note-row">
          <Avatar id={user.uid} name={member.name} size={36} />
          <span><strong>Owner: {member.name} (you).</strong> Only you can edit or delete this issue. Anyone can add tasks to it.</span>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="pill pill-lg" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create issue'}
        </button>
      </form>
    </Modal>
  );
}
