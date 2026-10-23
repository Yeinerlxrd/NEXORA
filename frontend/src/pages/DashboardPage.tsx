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
import { SectionHeading } from '../components/SectionHeading';
import { StatCard } from '../components/StatCard';
import { getDashboard } from '../lib/api';
import { parseCalendarDate } from '../lib/date';
import type { DashboardData } from '../types';

function formatDueDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = parseCalendarDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(date);
}

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
    return (
      <div className="view dashboard-view">
        <div className="panel loading-state" role="status" aria-live="polite">
          Cargando tu resumen…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="view dashboard-view">
        <section className="panel error-state" role="alert">
          <p>{error || 'No se pudo cargar el dashboard.'}</p>
          <button className="secondary-button" onClick={() => void loadDashboard()}>
            Reintentar
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="view dashboard-view">
      <section className="welcome">
        <div>
          <span className="date-label">{data.date}</span>
          <h1>{data.hello}<span className="welcome-spark" aria-hidden="true"> ✦</span></h1>
          <p>Tu actividad y tus espacios de trabajo, en un solo lugar.</p>
        </div>
        <Link className="focus-button" to="/tasks">
          <ListTodo size={16} aria-hidden="true" />
          Ver mis tareas
        </Link>
      </section>

      <section className="stats-strip" aria-label="Resumen de actividad">
        <StatCard
          label="Tareas pendientes"
          value={data.summary.pending_tasks}
          accent={<ListTodo size={17} aria-hidden="true" />}
        />
        <StatCard
          label="Proyectos propios"
          value={data.summary.projects}
          accent={<FolderKanban size={17} aria-hidden="true" />}
        />
        <StatCard
          label="Grupos"
          value={data.summary.groups}
          accent={<Users size={17} aria-hidden="true" />}
        />
        <StatCard
          label="Próximas entregas"
          value={data.summary.upcoming_tasks}
          accent={<CalendarDays size={17} aria-hidden="true" />}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel dashboard-panel" aria-labelledby="upcoming-title">
          <SectionHeading id="upcoming-title" eyebrow="EN FOCO" title="Tareas próximas" to="/tasks" action="Ver tareas" />
          {data.upcoming_tasks.length > 0 ? (
            <ul className="dashboard-list">
              {data.upcoming_tasks.map(task => {
                const dueDate = formatDueDate(task.due_at);

                return (
                  <li className="dashboard-row" key={task.id}>
                    <span className="task-marker" aria-hidden="true" />
                    <div className="dashboard-row-copy">
                      <b>{task.title}</b>
                      <small>
                        {task.project?.name ?? 'Tarea'}
                        {dueDate ? ` · ${dueDate}` : ''}
                      </small>
                    </div>
                    <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <p>No tienes tareas próximas asignadas.</p>
              <Link to="/tasks">Abrir tareas <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        <section className="panel dashboard-panel" aria-labelledby="notifications-title">
          <SectionHeading id="notifications-title" eyebrow="ACTIVIDAD" title="Notificaciones recientes" to="/notifications" action="Ver todas" />
          {data.notifications.length > 0 ? (
            <ul className="dashboard-list">
              {data.notifications.map(note => (
                <li className="dashboard-row notification-row" key={note.id}>
                  <span className="notification-marker">
                    <Bell size={13} aria-hidden="true" />
                  </span>
                  <div className="dashboard-row-copy">
                    <b>{note.title}</b>
                    <small>{note.message}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">No hay notificaciones recientes.</p>
          )}
        </section>

        <section className="panel dashboard-panel" aria-labelledby="projects-title">
          <SectionHeading id="projects-title" eyebrow="WORKSPACE" title="Proyectos recientes" to="/projects" action="Ver proyectos" />
          {data.recent_projects.length > 0 ? (
            <ul className="dashboard-list">
              {data.recent_projects.map(project => (
                <li className="dashboard-row project-row" key={project.id}>
                  <span className="project-mark">
                    <FolderKanban size={15} aria-hidden="true" />
                  </span>
                  <div className="dashboard-row-copy">
                    <b>{project.name}</b>
                    <small>{project.group?.name ?? project.status}</small>
                  </div>
                  <span className={`priority-badge priority-${project.priority.toLowerCase()}`}>
                    {project.priority}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <p>Aún no tienes proyectos.</p>
              <Link to="/projects">Crear proyecto <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        <section className="panel dashboard-panel" aria-labelledby="groups-title">
          <SectionHeading id="groups-title" eyebrow="COMUNIDAD" title="Tus grupos" to="/groups" action="Ver grupos" />
          {data.recent_groups.length > 0 ? (
            <ul className="dashboard-list">
              {data.recent_groups.map(group => (
                <li className="dashboard-row" key={group.id}>
                  <span className="group-mark">
                    <Users size={15} aria-hidden="true" />
                  </span>
                  <div className="dashboard-row-copy">
                    <b>{group.name}</b>
                    <small>{group.members_count} miembros</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <p>Aún no perteneces a grupos.</p>
              <Link to="/groups">Explorar grupos <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          )}
        </section>
      </div>

      <section className="quick-access" aria-labelledby="quick-access-title">
        <SectionHeading id="quick-access-title" eyebrow="ACCESOS RÁPIDOS" title="Continúa desde aquí" />
        <div className="quick-link-list">
          {data.quick_links.map(link => (
            <Link key={link.label} to={link.href}>
              <span>{link.label}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
