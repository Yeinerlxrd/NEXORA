import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createTask,
  deleteTask,
  getCurrentUser,
  getGroupMembers,
  getProjects,
  getTasks,
  updateTask,
} from '../lib/api';
import { parseCalendarDate } from '../lib/date';
import { filterTasks } from '../lib/taskFilters';
import type { GroupMember, Project, Task } from '../types';

type TaskForm = {
  title: string;
  description: string;
  project_id: string;
  assignee_public_id: string;
  status: Task['status'];
  priority: Task['priority'];
  due_at: string;
};

const emptyForm: TaskForm = {
  title: '',
  description: '',
  project_id: '',
  assignee_public_id: '',
  status: 'Pendiente',
  priority: 'Media',
  due_at: '',
};

function dateInputValue(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin vencimiento';
  const date = parseCalendarDate(value);
  return date ? new Intl.DateTimeFormat('es').format(date) : 'Fecha no válida';
}

function isOverdue(task: Task): boolean {
  if (!task.due_at || task.status === 'Completada') return false;
  const localToday = new Date();
  const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
  return task.due_at.slice(0, 10) < today;
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignees, setAssignees] = useState<GroupMember[]>([]);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingTask, setChangingTask] = useState<number | null>(null);

  async function refreshTasks(): Promise<void> {
    setTasks(await getTasks());
  }

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudieron cargar las tareas.'))
      .finally(() => setLoading(false));
    getProjects()
      .then(setProjects)
      .catch(err => setError(err instanceof Error
        ? `Las tareas siguen disponibles, pero no se pudieron cargar los proyectos: ${err.message}`
        : 'No se pudieron cargar los proyectos para crear tareas.'));
  }, []);

  async function loadAssignees(projectId: string): Promise<GroupMember[]> {
    const project = projects.find(item => item.id === Number(projectId));
    if (!project) {
      setAssignees([]);
      return [];
    }

    const members = project.group?.id ? await getGroupMembers(project.group.id) : [];
    const currentUser = getCurrentUser();
    if (currentUser?.public_id && project.creator_public_id === currentUser.public_id
      && !members.some(member => member.public_id === currentUser.public_id)) {
      members.unshift({
        public_id: currentUser.public_id,
        name: currentUser.name,
        avatar_url: currentUser.avatar_url,
        bio: currentUser.bio,
        role: 'Owner',
      });
    }
    setAssignees(members);
    return members;
  }

  async function chooseProject(projectId: string): Promise<void> {
    setForm(current => ({ ...current, project_id: projectId, assignee_public_id: '' }));
    setAssignees([]);
    setError('');
    if (!projectId) return;
    try {
      await loadAssignees(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las personas del proyecto.');
    }
  }

  function startEditing(task: Task): void {
    setEditingTask(task);
    setNotice('');
    setError('');
    setForm({
      title: task.title,
      description: task.description ?? '',
      project_id: String(task.project_id),
      assignee_public_id: task.assignee?.public_id ?? '',
      status: task.status,
      priority: task.priority,
      due_at: dateInputValue(task.due_at),
    });
    void loadAssignees(String(task.project_id)).catch(err => {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las personas del proyecto.');
    });
  }

  function cancelEditing(): void {
    setEditingTask(null);
    setForm(emptyForm);
    setAssignees([]);
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    let saved = false;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      project_id: Number(form.project_id),
      assignee_public_id: form.assignee_public_id || null,
      status: form.status,
      priority: form.priority,
      due_at: form.due_at || null,
    };

    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload);
        setNotice('La tarea se actualizó correctamente.');
      } else {
        await createTask(payload);
        setNotice('La tarea se creó correctamente.');
      }
      setEditingTask(null);
      setForm(emptyForm);
      setAssignees([]);
      saved = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tarea.');
    } finally {
      setSaving(false);
    }

    if (saved) {
      try {
        await refreshTasks();
      } catch (err) {
        setError(err instanceof Error
          ? `La tarea se guardó, pero no se pudo actualizar la lista: ${err.message}`
          : 'La tarea se guardó, pero no se pudo actualizar la lista.');
      }
    }
  }

  async function handleDelete(task: Task): Promise<void> {
    if (!window.confirm(`¿Eliminar la tarea «${task.title}»? Esta acción no se puede deshacer.`)) return;
    setChangingTask(task.id);
    setError('');
    setNotice('');
    try {
      await deleteTask(task.id);
      setTasks(current => current.filter(item => item.id !== task.id));
      if (editingTask?.id === task.id) cancelEditing();
      setNotice('La tarea se eliminó.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la tarea.');
    } finally {
      setChangingTask(null);
    }
  }

  const currentUser = getCurrentUser();
  const visibleTasks = useMemo(
    () => filterTasks(tasks, { search, status: statusFilter, priority: priorityFilter }),
    [tasks, search, statusFilter, priorityFilter],
  );

  return (
    <section className="view tasks-view" aria-labelledby="tasks-title">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / TAREAS</span>
          <h1 id="tasks-title">Tareas</h1>
          <p>Organiza entregas, responsables y estados de tus proyectos.</p>
        </div>
        <div className="social-header-stats" aria-label="Resumen de tareas">
          <span className="social-stat"><b>{tasks.length}</b> tareas</span>
          <span className="social-stat"><b>{visibleTasks.length}</b> visibles</span>
        </div>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notification-notice" role="status">{notice}</p>}

      <section className="card" aria-labelledby="task-form-title">
        <div className="section-header">
          <h2 id="task-form-title">{editingTask ? 'Editar tarea' : 'Crear tarea'}</h2>
          {editingTask && <button className="button secondary" type="button" onClick={cancelEditing}><X size={14} /> Cancelar edición</button>}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="task-title">Título</label>
            <input id="task-title" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={150} required />
          </div>
          <div className="form-field">
            <label htmlFor="task-description">Descripción</label>
            <textarea id="task-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={500} rows={3} />
          </div>
          <div className="grid grid-2">
            <div className="form-field">
              <label htmlFor="task-project">Proyecto</label>
              <select id="task-project" value={form.project_id} onChange={event => void chooseProject(event.target.value)} required>
                <option value="">Selecciona un proyecto</option>
                {editingTask && !projects.some(project => project.id === editingTask.project_id) && (
                  <option value={editingTask.project_id}>{editingTask.project?.name ?? 'Proyecto actual'}</option>
                )}
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="task-assignee">Responsable</label>
              <select
                id="task-assignee"
                value={form.assignee_public_id}
                onChange={event => setForm({ ...form, assignee_public_id: event.target.value })}
                disabled={!form.project_id || assignees.length === 0}
              >
                <option value="">Sin asignar</option>
                {editingTask?.assignee && !assignees.some(person => person.public_id === editingTask.assignee?.public_id) && (
                  <option value={editingTask.assignee.public_id}>{editingTask.assignee.name} (asignación actual)</option>
                )}
                {assignees.map(person => <option key={person.public_id} value={person.public_id}>{person.name}{person.public_id === currentUser?.public_id ? ' (tú)' : ''}</option>)}
              </select>
              {form.project_id && assignees.length === 0 && <small>Este proyecto no tiene miembros disponibles para asignar.</small>}
            </div>
            <div className="form-field">
              <label htmlFor="task-status">Estado</label>
              <select id="task-status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as Task['status'] })}>
                <option>Pendiente</option><option>En progreso</option><option>En revisión</option><option>Completada</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="task-priority">Prioridad</label>
              <select id="task-priority" value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as Task['priority'] })}>
                <option>Baja</option><option>Media</option><option>Alta</option><option>Urgente</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="task-date">Fecha límite</label>
              <input id="task-date" type="date" value={form.due_at} onChange={event => setForm({ ...form, due_at: event.target.value })} />
            </div>
          </div>
          <button type="submit" className="button primary" disabled={saving || loading || !form.project_id}>
            {saving ? 'Guardando…' : editingTask ? <><Check size={15} /> Guardar cambios</> : <><Plus size={15} /> Crear tarea</>}
          </button>
        </form>
      </section>

      <section className="card task-list-card" aria-labelledby="task-list-title">
        <div className="section-header">
          <h2 id="task-list-title">Todas tus tareas</h2>
          <span>{visibleTasks.length} de {tasks.length}</span>
        </div>
        <div className="grid grid-3 task-filters">
          <div className="form-field">
            <label htmlFor="task-search">Buscar</label>
            <input id="task-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Título de la tarea" />
          </div>
          <div className="form-field">
            <label htmlFor="task-status-filter">Filtrar por estado</label>
            <select id="task-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="">Todos los estados</option><option>Pendiente</option><option>En progreso</option><option>En revisión</option><option>Completada</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="task-priority-filter">Filtrar por prioridad</label>
            <select id="task-priority-filter" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}>
              <option value="">Todas las prioridades</option><option>Baja</option><option>Media</option><option>Alta</option><option>Urgente</option>
            </select>
          </div>
        </div>

        {loading ? <p className="loading-state" role="status">Cargando tareas…</p> : visibleTasks.length ? (
          <ul className="task-list">
            {visibleTasks.map(task => {
              const canEdit = task.creator?.public_id === currentUser?.public_id || task.assignee?.public_id === currentUser?.public_id;
              const canDelete = task.creator?.public_id === currentUser?.public_id;
              return (
                <li className="task-list-row" key={task.id}>
                  <div className="task-list-copy">
                    <strong>{task.title}</strong>
                    <small>
                      {task.project?.name ?? 'Proyecto'} · {formatDate(task.due_at)}
                      {isOverdue(task) && <span className="task-overdue"> · Vencida</span>}
                    </small>
                    {task.assignee && <small>Responsable: {task.assignee.name}</small>}
                  </div>
                  <span className="task-status-label">{task.status}</span>
                  <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                  <div className="task-row-actions">
                    {canEdit && <button className="icon-button" type="button" aria-label={`Editar ${task.title}`} onClick={() => startEditing(task)}><Pencil size={15} aria-hidden="true" /></button>}
                    {canDelete && <button className="icon-button danger" type="button" aria-label={`Eliminar ${task.title}`} disabled={changingTask === task.id} onClick={() => void handleDelete(task)}><Trash2 size={15} aria-hidden="true" /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="empty">{tasks.length ? 'No hay tareas que coincidan con los filtros.' : 'Todavía no tienes tareas.'}</p>}
      </section>
    </section>
  );
}
