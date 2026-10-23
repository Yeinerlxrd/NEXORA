import { Archive, ArchiveRestore, FolderKanban, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  archiveProject,
  createProject,
  getCurrentUser,
  getArchivedProjects,
  getGroups,
  getProjects,
  restoreProject,
  updateProject,
} from '../lib/api';
import { parseCalendarDate } from '../lib/date';
import type { Group, Project } from '../types';

type ProjectForm = {
  name: string;
  description: string;
  status: string;
  priority: string;
  group_id: string;
  due_at: string;
};

const emptyForm: ProjectForm = {
  name: '',
  description: '',
  status: 'Planificación',
  priority: 'Media',
  group_id: '',
  due_at: '',
};

export function ProjectsPage() {
  const currentUser = getCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingProject, setChangingProject] = useState<number | null>(null);

  async function refreshProjects() {
    const [active, archived] = await Promise.all([getProjects(), getArchivedProjects()]);
    setProjects(active);
    setArchivedProjects(archived);
  }

  async function refreshAfterConfirmedChange() {
    try {
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error
        ? `La operación se confirmó, pero no se pudo actualizar la lista: ${err.message}`
        : 'La operación se confirmó, pero no se pudo actualizar la lista.');
    }
  }

  useEffect(() => {
    refreshProjects()
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
    getGroups()
      .then(setGroups)
      .catch(err => setError(err instanceof Error
        ? `Los proyectos están disponibles, pero no se pudieron cargar los grupos: ${err.message}`
        : 'No se pudieron cargar los grupos para vincular proyectos.'));
  }, []);

  function startEditing(project: Project) {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority,
      group_id: project.group_id ? String(project.group_id) : '',
      due_at: project.due_at ? project.due_at.slice(0, 10) : '',
    });
    setError('');
    setNotice('');
    document.getElementById('create-project')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEditing() {
    setEditingProject(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    let created = false;

    try {
      const payload = {
        ...form,
        group_id: form.group_id ? Number(form.group_id) : null,
        due_at: form.due_at || null,
      };
      if (editingProject) {
        await updateProject(editingProject.id, payload);
        setNotice('El proyecto se actualizó correctamente.');
      } else {
        await createProject(payload);
        setNotice('El proyecto se creó correctamente.');
      }
      setForm(emptyForm);
      setEditingProject(null);
      created = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el proyecto.');
    } finally {
      setSaving(false);
    }
    if (created) await refreshAfterConfirmedChange();
  }

  async function handleArchive(project: Project) {
    setChangingProject(project.id);
    setError('');
    setNotice('');
    let archived = false;

    try {
      const response = await archiveProject(project.id);
      setNotice(response.message);
      archived = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar el proyecto.');
    } finally {
      setChangingProject(null);
    }
    if (archived) await refreshAfterConfirmedChange();
  }

  async function handleRestore(project: Project) {
    setChangingProject(project.id);
    setError('');
    setNotice('');
    let restored = false;

    try {
      const response = await restoreProject(project.id);
      setNotice(response.message);
      restored = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restaurar el proyecto.');
    } finally {
      setChangingProject(null);
    }
    if (restored) await refreshAfterConfirmedChange();
  }

  const visibleProjects = showArchived ? archivedProjects : projects;

  return (
    <div className="view projects-view">
      <section className="welcome">
        <div>
          <span className="date-label">WORKSPACE / PROYECTOS</span>
          <h1>Tus proyectos</h1>
          <p>Organiza espacios de trabajo y conserva su historial al archivarlos.</p>
        </div>
        <a className="focus-button" href="#create-project"><Plus size={16} /> Nuevo proyecto</a>
      </section>

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <section className="panel project-create-panel" id="create-project">
        <div className="section-title">
          <div><span>WORKSPACE</span><h2>{editingProject ? 'Editar proyecto' : 'Crear proyecto'}</h2></div>
          <FolderKanban size={17} aria-hidden="true" />
        </div>
        <form className="project-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="project-name">Nombre</label>
            <input id="project-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={120} required />
          </div>
          <div className="form-field">
            <label htmlFor="project-description">Descripción</label>
            <textarea id="project-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={1000} rows={2} />
          </div>
          <div className="form-field">
            <label htmlFor="project-group">Grupo (opcional)</label>
            <select id="project-group" value={form.group_id} onChange={event => setForm({ ...form, group_id: event.target.value })}>
              <option value="">Proyecto personal</option>
              {groups.map((group: Group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </div>
          <div className="project-form-row">
            <div className="form-field">
              <label htmlFor="project-status">Estado</label>
              <select id="project-status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
                <option>Planificación</option><option>En progreso</option><option>En revisión</option><option>Completado</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="project-priority">Prioridad</label>
              <select id="project-priority" value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
                <option>Baja</option><option>Media</option><option>Alta</option><option>Urgente</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="project-date">Fecha límite</label>
              <input id="project-date" type="date" value={form.due_at} onChange={event => setForm({ ...form, due_at: event.target.value })} />
            </div>
          </div>
          <div className="project-form-actions">
            <button type="submit" className="focus-button" disabled={saving}>
              {editingProject ? <Pencil size={15} /> : <Plus size={15} />} {saving ? 'Guardando…' : editingProject ? 'Guardar cambios' : 'Crear proyecto'}
            </button>
            {editingProject && <button type="button" className="secondary-button" onClick={cancelEditing}><X size={15} /> Cancelar</button>}
          </div>
        </form>
      </section>

      <section className="panel project-list-panel">
        <div className="section-title">
          <div><span>PROYECTOS</span><h2>{showArchived ? 'Archivados' : 'Activos'}</h2></div>
          <div className="project-tabs" role="group" aria-label="Filtrar proyectos">
            <button className={!showArchived ? 'selected' : ''} onClick={() => setShowArchived(false)}>Activos ({projects.length})</button>
            <button className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(true)}>Archivados ({archivedProjects.length})</button>
          </div>
        </div>

        {loading ? (
          <p className="empty-inline" role="status">Cargando proyectos…</p>
        ) : visibleProjects.length > 0 ? (
          <div className="project-list">
            {visibleProjects.map(project => (
              <article className="project-list-row" key={project.id}>
                <span className="project-mark"><FolderKanban size={16} aria-hidden="true" /></span>
                <div className="dashboard-row-copy">
                  <b>{project.name}</b>
                  <small>{project.group?.name ?? project.status}{project.due_at ? ` · Vence ${parseCalendarDate(project.due_at)?.toLocaleDateString('es') ?? 'Fecha no válida'}` : ''}</small>
                </div>
                <span className={`priority-badge priority-${project.priority.toLowerCase()}`}>{project.priority}</span>
                {project.creator_public_id === currentUser?.public_id && !showArchived && (
                  <button className="icon-button" type="button" aria-label={`Editar ${project.name}`} onClick={() => startEditing(project)}>
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                )}
                {project.creator_public_id === currentUser?.public_id && (
                  showArchived ? (
                    <button className="secondary-button project-action" onClick={() => void handleRestore(project)} disabled={changingProject === project.id}>
                      <ArchiveRestore size={15} /> {changingProject === project.id ? 'Restaurando…' : 'Restaurar'}
                    </button>
                  ) : (
                    <button className="secondary-button project-action" onClick={() => void handleArchive(project)} disabled={changingProject === project.id}>
                      <Archive size={15} /> {changingProject === project.id ? 'Archivando…' : 'Archivar'}
                    </button>
                  )
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-inline">{showArchived ? 'No hay proyectos archivados.' : 'Aún no tienes proyectos activos.'}</p>
        )}
      </section>
    </div>
  );
}
