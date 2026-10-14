import { useEffect, useState } from 'react';
import { createGroup, getGroups } from '../lib/api';
import type { Group } from '../types';

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      setGroups(await getGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los grupos.');
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
      await createGroup({ name, description });
      setName('');
      setDescription('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div className="section-header">
          <h1>Grupos</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="group-name">Nombre</label>
            <input id="group-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="group-description">Descripción</label>
            <textarea id="group-description" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          </div>
          {error && <div className="alert">{error}</div>}
          <button type="submit" className="button primary" disabled={loading}>{loading ? 'Creando...' : 'Crear grupo'}</button>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Miembros</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <tr key={group.id}>
                <td>{group.name}</td>
                <td>{group.description ?? 'Sin descripción'}</td>
                <td>{group.members_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {groups.length === 0 && <div className="empty">Todavía no hay grupos.</div>}
      </div>
    </div>
  );
}
