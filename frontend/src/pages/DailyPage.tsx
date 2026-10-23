import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CircleAlert, ListTodo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentUser, getProfile, getTasks } from '../lib/api';
import { parseCalendarDate } from '../lib/date';
import { selectDailyTasks } from '../lib/daily';
import type { Task } from '../types';

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  const date = parseCalendarDate(value);
  return date ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' }).format(date) : 'Fecha no válida';
}

export function DailyPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPublicId, setCurrentPublicId] = useState(getCurrentUser()?.public_id);
  const today = localDateKey(new Date());

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [taskList, user] = await Promise.all([
        getTasks(),
        currentPublicId ? Promise.resolve(null) : getProfile(),
      ]);
      setTasks(taskList);
      if (user?.public_id) setCurrentPublicId(user.public_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu agenda.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const { dueToday, overdue } = useMemo(
    () => selectDailyTasks(tasks, currentPublicId, today),
    [currentPublicId, tasks, today],
  );

  return (
    <section className="view daily-view" aria-labelledby="daily-title">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / DAILY</span>
          <h1 id="daily-title">Tu agenda</h1>
          <p>{new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
        </div>
        <Link className="focus-button" to="/tasks">
          <ListTodo size={16} aria-hidden="true" />
          Ver todas las tareas
        </Link>
      </header>

      <p className="daily-scope-note">
        Aquí aparecen tus tareas propias o asignadas con vencimiento. Hábitos y objetivos todavía no tienen persistencia en NEXORA.
      </p>

      {error && (
        <div className="alert" role="alert">
          {error}
          <button className="button secondary notification-action" type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="panel loading-state" role="status" aria-live="polite">Cargando tu agenda…</div>
      ) : !error && (
        <>
          <div className="daily-summary" aria-label="Resumen de tareas">
            <article className="stat-card">
              <span className="stat-card-icon"><CalendarDays size={17} aria-hidden="true" /></span>
              <span className="stat-card-copy"><b className="value">{dueToday.length}</b><small className="label">Vencen hoy</small></span>
            </article>
            <article className="stat-card">
              <span className="stat-card-icon"><CircleAlert size={17} aria-hidden="true" /></span>
              <span className="stat-card-copy"><b className="value">{overdue.length}</b><small className="label">Vencidas sin completar</small></span>
            </article>
          </div>

          <section className="panel daily-panel" aria-labelledby="daily-today-title">
            <div className="section-title">
              <div><span>EN FOCO</span><h2 id="daily-today-title">Para hoy</h2></div>
              <span className="notification-summary">{formatDate(today)}</span>
            </div>
            {dueToday.length ? (
              <ul className="daily-task-list">
                {dueToday.map(task => (
                  <li className="daily-task-row" key={task.id}>
                    <div className="dashboard-row-copy">
                      <b>{task.title}</b>
                      <small>{task.project?.name ?? 'Proyecto'} · {task.status}</small>
                    </div>
                    <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                    <Link className="icon-button" to="/tasks" aria-label={`Abrir tareas para ${task.title}`}>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dashboard-empty">
                <p>No tienes tareas propias o asignadas que venzan hoy.</p>
                <Link to="/tasks">Crear o revisar tareas <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            )}
          </section>

          {overdue.length > 0 && (
            <section className="panel daily-panel" aria-labelledby="daily-overdue-title">
              <div className="section-title">
                <div><span>REQUIEREN ATENCIÓN</span><h2 id="daily-overdue-title">Vencidas</h2></div>
                <span className="daily-overdue-count">{overdue.length}</span>
              </div>
              <ul className="daily-task-list">
                {overdue.map(task => (
                  <li className="daily-task-row overdue" key={task.id}>
                    <div className="dashboard-row-copy">
                      <b>{task.title}</b>
                      <small>{task.project?.name ?? 'Proyecto'} · Venció el {formatDate(task.due_at ?? '')}</small>
                    </div>
                    <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                    <Link className="icon-button" to="/tasks" aria-label={`Revisar tarea vencida ${task.title}`}>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
