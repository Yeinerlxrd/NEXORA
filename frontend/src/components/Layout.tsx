import { BarChart3, FolderKanban, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../lib/api';

const navItems = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard },
  { to: '/groups', label: 'Grupos', icon: Users },
  { to: '/projects', label: 'Proyectos', icon: FolderKanban },
  { to: '/tasks', label: 'Tareas', icon: BarChart3 },
];

export function Layout() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <span>NEXORA</span>
        </div>

        <nav style={{ display: 'grid', gap: 8 }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 28 }} className="card">
          <div style={{ fontSize: '0.75rem', color: '#9aa6bd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Sesión
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar">{user?.name?.slice(0, 1) ?? 'U'}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{user?.name}</div>
              <div style={{ color: '#9aa6bd', fontSize: '0.8rem' }}>{user?.email}</div>
            </div>
          </div>
          <button style={{ marginTop: 16, width: '100%' }} className="button secondary" onClick={handleLogout}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><LogOut size={16} /> Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
