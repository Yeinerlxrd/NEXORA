import {
  ArrowRight,
  Bell,
  CalendarDays,
  FolderKanban,
  ListTodo,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { getDashboard } from '../lib/api';
import type { DashboardData } from '../types';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setError('');
    setLoading(true);
    try {
      setData(await getDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading) {
    return <div className="view dashboard-view"><div className="panel loading-state" role="status">Cargando tu resumen…</div></div>;
  }

  if (error || !data) {
    return (
      <div className="view dashboard-view">
        <section className="panel error-state" role="alert">
          <p>{error || 'No se pudo cargar el dashboard.'}</p>
          <button className="secondary-button" onClick={() => void loadDashboard()}>Reintentar</button>
        </section>
      </div>
    );
  }

  return (
    <div className="view dashboard-view">
      <section className="welcome">
        <div>
          <span className="date-label">{data.date}</span>
          <h1>{data.hello}<span className="welcome-spark"> ✦</span></h1>
          <p>Tu actividad y tus espacios de trabajo, en un solo lugar.</p>
        </div>
        <Link className="focus-button" to="/tasks"><ListTodo size={16} /> Ver mis tareas</Link>
      </section>

      <section className="stats-strip" aria-label="Resumen">
        <StatCard label="Tareas pendientes" value={data.summary.pending_tasks} accent={<ListTodo size={18} />} />
        <StatCard label="Proyectos" value={data.summary.projects} accent={<FolderKanban size={18} />} />
        <StatCard label="Grupos" value={data.summary.groups} accent={<Users size={18} />} />
        <div className="stats-note">
          <CalendarDays size={17} aria-hidden="true" />
          <span>Próximas entregas</span>
          <b>{data.upcoming_tasks.length}</b>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <div><span>PRÓXIMAS</span><h2>Tareas por atender</h2></div>
            <Link to="/tasks">Ver tareas <ArrowRight size={14} /></Link>
          </div>
          {data.upcoming_tasks.length > 0 ? (
            <div className="dashboard-list">
              {data.upcoming_tasks.map(task => (
                <div className="dashboard-row" key={task.id}>
                  <span className="task-marker" aria-hidden="true" />
                  <div className="dashboard-row-copy">
                    <b>{task.title}</b>
                    <small>{task.project?.name ?? 'Proyecto'}{task.due_at ? ` · ${new Date(task.due_at).toLocaleDateString()}` : ''}</small>
                  </div>
                  <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-inline">No tienes tareas próximas asignadas.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-title">
            <div><span>ACTIVIDAD</span><h2>Notificaciones recientes</h2></div>
            <Bell size={16} aria-hidden="true" />
          </div>
          {data.notifications.length > 0 ? (
            <div className="dashboard-list">
              {data.notifications.map(note => (
                <div className="dashboard-row notification-row" key={note.id}>
                  <span className="notification-marker"><Bell size={13} aria-hidden="true" /></span>
                  <div className="dashboard-row-copy">
                    <b>{note.title}</b>
                    <small>{note.message}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-inline">No hay notificaciones recientes.</p>
          )}
          <Link className="panel-footer-link" to="/notifications">Centro de notificaciones <ArrowRight size={14} /></Link>
        </section>

        <section className="panel">
          <div className="section-title">
            <div><span>WORKSPACE</span><h2>Proyectos recientes</h2></div>
            <Link to="/projects">Todos <ArrowRight size={14} /></Link>
          </div>
          {data.recent_projects.length > 0 ? (
            <div className="dashboard-list">
              {data.recent_projects.map(project => (
                <div className="dashboard-row project-row" key={project.id}>
                  <span className="project-mark"><FolderKanban size={15} aria-hidden="true" /></span>
                  <div className="dashboard-row-copy">
                    <b>{project.name}</b>
                    <small>{project.group?.name ?? project.status}</small>
                  </div>
                  <span className={`priority-badge priority-${project.priority.toLowerCase()}`}>{project.priority}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">Aún no tienes proyectos. <Link to="/projects">Crear proyecto</Link></div>
          )}
        </section>

        <section className="panel">
          <div className="section-title">
            <div><span>COMUNIDAD</span><h2>Tus grupos</h2></div>
            <Link to="/groups">Ver grupos <ArrowRight size={14} /></Link>
          </div>
          {data.recent_groups.length > 0 ? (
            <div className="dashboard-list">
              {data.recent_groups.map(group => (
                <div className="dashboard-row" key={group.id}>
                  <span className="group-mark"><Users size={15} aria-hidden="true" /></span>
                  <div className="dashboard-row-copy">
                    <b>{group.name}</b>
                    <small>{group.members_count} miembros</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">Aún no perteneces a grupos. <Link to="/groups">Crear grupo</Link></div>
          )}
        </section>
      </div>

      <section className="quick-access">
        <div className="section-title">
          <div><span>ACCESOS RÁPIDOS</span><h2>Continúa desde aquí</h2></div>
        </div>
        <div className="quick-link-list">
          {data.quick_links.map(link => (
            <Link key={link.label} to={link.href}>
              <span>{link.label}</span><ArrowRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
