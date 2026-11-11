import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './firebase.js';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { DataProvider } from './lib/data.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import Layout from './components/Layout.jsx';
import { Loading, Logo } from './components/ui.jsx';
import AuthPage, { FinishProfile } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import IssuesPage from './pages/Issues.jsx';
import IssueDetail from './pages/IssueDetail.jsx';
import IssueForm from './pages/IssueForm.jsx';
import TaskPanel from './pages/TaskPanel.jsx';
import TaskForm from './pages/TaskForm.jsx';
import CalendarPage from './pages/Calendar.jsx';
import Members from './pages/Members.jsx';
import MemberProfile from './pages/MemberProfile.jsx';
import Me from './pages/Me.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Admin from './pages/Admin.jsx';

function Gate() {
  const { user, member, banned, isAdmin } = useAuth();
  if (user === undefined) return <Loading />;
  if (!user) return <AuthPage />;
  if (banned === undefined) return <Loading />;
  if (banned) return <Removed />;
  if (member === undefined) return <Loading />;
  if (!member) return <FinishProfile />;
  return (
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="issues" element={<IssuesPage />}>
              <Route path="new" element={<IssueForm />} />
              <Route path=":issueId" element={<IssueDetail />}>
                <Route path="edit" element={<IssueForm />} />
                <Route path="tasks/new" element={<TaskForm />} />
                <Route path="tasks/:taskId" element={<TaskPanel />}>
                  <Route path="edit" element={<TaskForm />} />
                </Route>
              </Route>
            </Route>
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="members" element={<Members />} />
            <Route path="members/:memberId" element={<MemberProfile />} />
            <Route path="me" element={<Me />}>
              <Route path="edit" element={<EditProfile />} />
            </Route>
            {isAdmin && <Route path="admin" element={<Admin />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}

function Removed() {
  const { logOut } = useAuth();
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="form-head">
          <Logo size={64} />
          <h1>You've been removed.</h1>
          <p>An admin removed this account from the community. If you think this is a mistake, contact one of the organizers.</p>
        </div>
        <div className="form">
          <button type="button" className="pill pill-lg" onClick={logOut}>Log out</button>
        </div>
      </div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="auth-page">
      <div className="form-head">
        <Logo size={64} />
        <h1>Almost ready.</h1>
        <p>Many Hands needs its Firebase keys. Add them to src/firebase.config.js, then deploy again. The README has the exact steps.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {isConfigured ? (
        <AuthProvider>
          <Gate />
        </AuthProvider>
      ) : <SetupNeeded />}
    </ThemeProvider>
  );
}
