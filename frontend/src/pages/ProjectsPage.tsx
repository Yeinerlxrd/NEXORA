import { useEffect, useState } from 'react';
import { createProject, getProjects } from '../lib/api';
import type { Project } from '../types';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ name: '', description: '', status: 'Planificación', priority: 'Media', due_at: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      setProjects(await getProjects());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los proyectos.');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createProject({ ...form, due_at: form.due_at || null });
      setForm({ name: '', description: '', status: 'Planificación', priority: 'Media', due_at: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el proyecto.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div className="section-header">
          <h1>Proyectos</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="project-name">Nombre</label>
            <input id="project-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="form-field">
            <label htmlFor="project-description">Descripción</label>
            <textarea id="project-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>

          <div className="grid grid-2">
            <div className="form-field">
              <label htmlFor="project-status">Estado</label>
              <select id="project-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option>Planificación</option>
                <option>En progreso</option>
                <option>En revisión</option>
                <option>Completado</option>
                <option>Archivado</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="project-priority">Prioridad</label>
              <select id="project-priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
                <option>Urgente</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="project-date">Fecha límite</label>
            <input id="project-date" type="date" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} />
          </div>

          {error && <div className="alert">{error}</div>}
          <button type="submit" className="button primary" disabled={loading}>{loading ? 'Creando...' : 'Nuevo proyecto'}</button>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Fecha límite</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.status}</td>
                <td>{project.priority}</td>
                <td>{project.due_at ?? 'Sin fecha'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {projects.length === 0 && <div className="empty">No hay proyectos aún.</div>}
      </div>
    </div>
  );
}
