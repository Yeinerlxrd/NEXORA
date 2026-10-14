import { useEffect, useState } from 'react';
import { createTask, getProjects, getTasks } from '../lib/api';
import type { Project, Task } from '../types';

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ title: '', description: '', project_id: '', status: 'Pendiente', priority: 'Media', due_at: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      setTasks(await getTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tareas.');
    }
  };

  useEffect(() => {
    void refresh();
    getProjects()
      .then(setProjects)
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudieron cargar los proyectos.'));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createTask({
        ...form,
        project_id: Number(form.project_id),
        assignee_id: null,
        due_at: form.due_at || null,
      });
      setForm({ ...form, title: '', description: '', due_at: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div className="section-header">
          <h1>Tareas</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="task-title">Título</label>
            <input id="task-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-field">
            <label htmlFor="task-description">Descripción</label>
            <textarea id="task-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>
          <div className="grid grid-2">
            <div className="form-field">
              <label htmlFor="task-project">Proyecto</label>
              <select
                id="task-project"
                value={form.project_id}
                onChange={e => setForm({ ...form, project_id: e.target.value })}
                required
              >
                <option value="">Selecciona un proyecto</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="task-status">Estado</label>
              <select id="task-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option>Pendiente</option>
                <option>En progreso</option>
                <option>En revisión</option>
                <option>Completada</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="task-priority">Prioridad</label>
              <select id="task-priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
                <option>Urgente</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="task-date">Fecha límite</label>
            <input id="task-date" type="date" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} />
          </div>
          {error && <div className="alert">{error}</div>}
          <button type="submit" className="button primary" disabled={loading}>{loading ? 'Creando...' : 'Nueva tarea'}</button>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Vence</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.status}</td>
                <td>{task.priority}</td>
                <td>{task.due_at ?? 'Sin vencimiento'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {tasks.length === 0 && <div className="empty">Sin tareas en el tablero.</div>}
      </div>
    </div>
  );
}
