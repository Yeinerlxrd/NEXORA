import {
  Bell,
  Command,
  FolderKanban,
  Gamepad2,
  Home,
  Link2,
  LogOut,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
  ListTodo,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../lib/api';

const navigation = [
  { to: '/', label: 'Core', icon: Home, section: 'Espacio', end: true },
  { to: '/projects', label: 'Workspace', icon: FolderKanban, section: 'Espacio', end: false },
  { to: '/tasks', label: 'Tareas', icon: ListTodo, section: 'Espacio', end: false },
  { to: '/groups', label: 'Grupos', icon: Users, section: 'Espacio', end: false },
  { to: '/daily', label: 'Daily', icon: Sun, section: 'Espacio', end: false },
  { to: '/gaming', label: 'Gaming', icon: Gamepad2, section: 'Espacio', end: false },
  { to: '/social', label: 'Social', icon: Users, section: 'Espacio', end: false },
  { to: '/discord', label: 'Discord', icon: Link2, section: 'Espacio', end: false },
  { to: '/notifications', label: 'Notificaciones', icon: Bell, section: 'Sistema', end: false },
  { to: '/settings', label: 'Ajustes', icon: Settings, section: 'Sistema', end: false },
];

const pageTitles: Record<string, string> = {
  '/': 'Core',
  '/projects': 'Workspace',
  '/tasks': 'Tareas',
  '/groups': 'Grupos',
  '/daily': 'Daily',
  '/gaming': 'Gaming',
  '/social': 'Social',
  '/discord': 'Discord',
  '/notifications': 'Notificaciones',
  '/settings': 'Ajustes',
};

export function Layout() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const title = pageTitles[location.pathname] ?? 'Core';

  const commands = useMemo(
    () => navigation.filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(open => !open);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setCreateOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  async function handleLogout() {
    setLogoutError('');
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión en el servidor.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <div className="energy-line line-one" aria-hidden="true" />
      <div className="energy-line line-two" aria-hidden="true" />

      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="NEXORA, ir al Core">
          <span className="brand-mark" aria-hidden="true"><i /><i /><b /></span>
          <span>NEXORA</span>
        </Link>

        <nav className="main-nav" aria-label="Navegación principal">
          <span className="nav-label">ESPACIO</span>
          {navigation.filter(item => item.section === 'Espacio').map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}

          <span className="nav-label second">SISTEMA</span>
          {navigation.filter(item => item.section === 'Sistema').map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-row">
            <span className="avatar">{user?.name?.slice(0, 2).toUpperCase() ?? 'NX'}</span>
            <span className="profile-copy">
              <b>{user?.name ?? 'Cuenta NEXORA'}</b>
              <small>{user?.email ?? ''}</small>
            </span>
          </div>
          <button className="logout-button" onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={15} aria-hidden="true" />
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>NEXORA</span><i>/</i><b>{title}</b></div>
          <button className="search-trigger" onClick={() => setCommandOpen(true)} aria-label="Abrir navegación rápida">
            <Search size={15} aria-hidden="true" />
            <span>Ir a una sección...</span>
            <kbd><Command size={10} aria-hidden="true" /> K</kbd>
          </button>
          <div className="top-actions">
            <div className="create-menu">
              <button
                className="quick-button"
                aria-expanded={createOpen}
                aria-haspopup="menu"
                onClick={() => setCreateOpen(open => !open)}
              >
                <Plus size={15} aria-hidden="true" /><span>Crear</span>
              </button>
              {createOpen && (
                <div className="create-popover" role="menu" aria-label="Crear elemento">
                  <Link role="menuitem" to="/projects" onClick={() => setCreateOpen(false)}>Proyecto</Link>
                  <Link role="menuitem" to="/tasks" onClick={() => setCreateOpen(false)}>Tarea</Link>
                  <Link role="menuitem" to="/groups" onClick={() => setCreateOpen(false)}>Grupo</Link>
                </div>
              )}
            </div>
            <Link className="icon-button" to="/notifications" aria-label="Notificaciones">
              <Bell size={16} aria-hidden="true" />
            </Link>
            <span className="avatar top-avatar" aria-label={user?.name ?? 'Usuario'}>
              {user?.name?.slice(0, 2).toUpperCase() ?? 'NX'}
            </span>
          </div>
        </header>

        {logoutError && <p className="logout-error-banner" role="alert">{logoutError}</p>}
        <div className="page-transition" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      {commandOpen && (
        <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}>
          <section
            className="command-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="command-input">
              <Search size={17} aria-hidden="true" />
              <label className="sr-only" id="command-title" htmlFor="command-search">Ir a una sección de NEXORA</label>
              <input
                id="command-search"
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar una sección..."
              />
              <button onClick={() => setCommandOpen(false)} aria-label="Cerrar navegación rápida"><X size={17} /></button>
            </div>
            <div className="command-results">
              <span>SECCIONES</span>
              {commands.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={() => { setCommandOpen(false); setQuery(''); }}>
                  <Icon size={16} aria-hidden="true" /><span>{label}</span>
                </Link>
              ))}
              {commands.length === 0 && <p className="command-empty">No se encontraron secciones.</p>}
            </div>
            <footer><span><kbd>Esc</kbd> Cerrar</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd> Abrir</span></footer>
          </section>
        </div>
      )}
    </div>
  );
}
