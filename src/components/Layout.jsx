import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData, useOnline } from '../lib/data.jsx';
import { Avatar, Icons, Loading, Logo } from './ui.jsx';

const LINKS = [
  { to: '/', label: 'Home', icon: Icons.home, end: true },
  { to: '/issues', label: 'Issues', icon: Icons.issues },
  { to: '/members', label: 'Members', icon: Icons.members },
  { to: '/me', label: 'Me', icon: Icons.me },
];

// One <nav>: a bottom bar under 900px, a left sidebar from 900px up.
export default function Layout() {
  const { member } = useAuth();
  const { loading } = useData();
  const online = useOnline();
  const { pathname } = useLocation();

  // Scroll to the top on a new page, but not when a dialog opens over the current one.
  const page = pathname.replace(/\/(tasks\/.*|edit|new)$/, '');
  useEffect(() => window.scrollTo(0, 0), [page]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <Logo size={30} />
          Many Hands
        </NavLink>
        <nav aria-label="Main" className="nav-links">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        {member && (
          <NavLink to="/me" className="sidebar-me">
            <Avatar id={member.id} name={member.name} size={32} />
            <span>{member.name}</span>
          </NavLink>
        )}
      </aside>
      <main className="content">
        {!online && (
          <div role="status" className="offline-pill">
            <Icons.offline />
            You're offline. What you've already seen is saved on this device.
          </div>
        )}
        {loading ? <Loading /> : <Outlet />}
      </main>
    </div>
  );
}

// The small centered title bar at the top of each mobile screen.
export function TopBar({ children }) {
  return <header className="topbar">{children}</header>;
}
