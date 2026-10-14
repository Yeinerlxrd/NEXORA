import { ArrowRight, Bell, CalendarDays, FolderKanban, ListTodo, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getDashboard } from '../lib/api';
import type { DashboardData } from '../types';
import { StatCard } from '../components/StatCard';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.'));
  }, []);

  if (error) return <div className="alert" role="alert">{error}</div>;
  if (!data) return <div className="card empty">Cargando Command Center…</div>;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="label">Dashboard</div>
          <h1 style={{ marginTop: 8 }}>{data.hello}</h1>
        </div>
        <div className="user-pill">
          <CalendarDays size={18} color="#22d3ee" />
          <span>{data.date}</span>
        </div>
      </div>

      <div className="grid grid-3">
        <StatCard label="Tareas pendientes" value={data.summary.pending_tasks} accent={<ListTodo size={26} color="#22d3ee" />} />
        <StatCard label="Proyectos" value={data.summary.projects} accent={<FolderKanban size={26} color="#8b5cf6" />} />
        <StatCard label="Grupos" value={data.summary.groups} accent={<Users size={26} color="#22d3ee" />} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-header">
            <h2>Tareas próximas a vencer</h2>
          </div>
          <div className="list">
            {data.upcoming_tasks.map(task => (
              <div key={task.id} className="list-item">
                <div>
                  <strong>{task.title}</strong>
                  <div style={{ color: '#9aa6bd', marginTop: 4 }}>{task.project?.name}</div>
                </div>
                <span className="badge">{task.priority}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <h2>Notificaciones</h2>
            <Bell size={18} color="#22d3ee" />
          </div>
          <div className="list">
            {data.notifications.map(note => (
              <div key={note.id} className="list-item">
                <div>
                  <strong>{note.title}</strong>
                  <div style={{ color: '#9aa6bd', marginTop: 4 }}>{note.message}</div>
                </div>
                <ArrowRight size={18} color="#9aa6bd" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-header">
            <h2>Proyectos recientes</h2>
          </div>
          <div className="list">
            {data.recent_projects.map(project => (
              <div key={project.id} className="list-item">
                <div>
                  <strong>{project.name}</strong>
                  <div style={{ color: '#9aa6bd', marginTop: 4 }}>{project.status}</div>
                </div>
                <span className="badge">{project.priority}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <h2>Grupos activos</h2>
          </div>
          <div className="list">
            {data.recent_groups.map(group => (
              <div key={group.id} className="list-item">
                <div>
                  <strong>{group.name}</strong>
                  <div style={{ color: '#9aa6bd', marginTop: 4 }}>{group.members_count} miembros</div>
                </div>
                <span className="badge">Activo</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-header">
          <h2>Accesos rápidos</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {data.quick_links.map(link => (
            <a key={link.label} href={link.href} className="button secondary">{link.label}</a>
          ))}
        </div>
      </div>
    </>
  );
}
