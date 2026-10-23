import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Award, CalendarDays, Check, Gamepad2, Plus, Trophy, Users, X } from 'lucide-react';
import { createQuest, getProfile, getQuests, joinQuest, updateQuestProgress } from '../lib/api';
import { parseCalendarDate } from '../lib/date';
import type { QuestRecord } from '../types';

type QuestForm = {
  title: string;
  description: string;
  category: string;
  difficulty: QuestRecord['difficulty'];
  due_at: string;
  reward_xp: string;
};

const emptyForm: QuestForm = {
  title: '',
  description: '',
  category: 'Productividad',
  difficulty: 'Media',
  due_at: '',
  reward_xp: '50',
};

function formatDate(value: string | null): string {
  const date = parseCalendarDate(value);
  return date ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Sin fecha límite';
}

export function GamingPage() {
  const [quests, setQuests] = useState<QuestRecord[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [xpTotal, setXpTotal] = useState<number | null>(null);
  const [currentPublicId, setCurrentPublicId] = useState<string | undefined>();
  const [form, setForm] = useState<QuestForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [progressDrafts, setProgressDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyQuest, setBusyQuest] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextPage = page) {
    setLoading(true);
    setError('');
    setProfileError('');
    try {
      const [result, profile] = await Promise.all([
        getQuests(nextPage),
        getProfile().catch(err => {
          setProfileError(err instanceof Error ? err.message : 'No se pudo cargar tu saldo de XP.');
          return null;
        }),
      ]);
      setQuests(result.data);
      setPage(result.current_page);
      setLastPage(result.last_page);
      setProgressDrafts(Object.fromEntries(result.data.map(quest => [quest.id, String(quest.my_progress ?? 0)])));
      if (profile) {
        setXpTotal(profile.xp_total ?? 0);
        setCurrentPublicId(profile.public_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los retos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createQuest({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        difficulty: form.difficulty,
        due_at: form.due_at || null,
        reward_xp: Number(form.reward_xp),
      });
      setForm(emptyForm);
      setFormOpen(false);
      setNotice('Reto creado. Otras personas pueden unirse y registrar su progreso.');
      await load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el reto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(quest: QuestRecord) {
    setBusyQuest(quest.id);
    setError('');
    setNotice('');
    try {
      await joinQuest(quest.id);
      setNotice(`Te uniste a «${quest.title}».`);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo unir al reto.');
    } finally {
      setBusyQuest(null);
    }
  }

  async function handleProgress(event: FormEvent<HTMLFormElement>, quest: QuestRecord) {
    event.preventDefault();
    setBusyQuest(quest.id);
    setError('');
    setNotice('');
    try {
      const result = await updateQuestProgress(quest.id, Number(progressDrafts[quest.id]));
      setNotice(result.xp_awarded > 0
        ? `Marcaste el reto como completado. Ganaste ${result.xp_awarded} XP.`
        : 'Progreso actualizado.');
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el progreso.');
    } finally {
      setBusyQuest(null);
    }
  }

  return (
    <section className="view gaming-view" aria-labelledby="gaming-title">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / GAMING</span>
          <h1 id="gaming-title">Retos gamificados</h1>
          <p>Convierte objetivos de productividad en retos compartidos con avance y recompensas persistentes.</p>
        </div>
        <div className="gaming-header-actions">
          <span className="xp-total"><Trophy size={16} aria-hidden="true" /> {xpTotal ?? '—'} XP</span>
          <button className="focus-button" type="button" onClick={() => setFormOpen(open => !open)} aria-expanded={formOpen}>
            {formOpen ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {formOpen ? 'Cerrar' : 'Crear reto'}
          </button>
        </div>
      </header>

      <p className="gaming-scope-note">
        Cada participante registra su propio progreso y la finalización no se verifica automáticamente. Los retos y puntos se guardan en NEXORA; esta sección no se conecta a bibliotecas de juegos ni a servicios externos.
      </p>

      {error && <div className="alert" role="alert">{error}</div>}
      {profileError && <p className="gaming-profile-note" role="status">El listado de retos está disponible, pero {profileError.toLowerCase()}</p>}
      {notice && <p className="notification-notice" role="status">{notice}</p>}

      {formOpen && (
        <section className="panel gaming-form-panel" aria-labelledby="create-quest-title">
          <h2 id="create-quest-title">Crear un reto</h2>
          <form onSubmit={handleCreate}>
            <div className="form-field">
              <label htmlFor="quest-title">Título</label>
              <input id="quest-title" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={120} required />
            </div>
            <div className="form-field">
              <label htmlFor="quest-description">Descripción</label>
              <textarea id="quest-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={1000} rows={3} />
            </div>
            <div className="gaming-form-grid">
              <div className="form-field">
                <label htmlFor="quest-category">Categoría</label>
                <select id="quest-category" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>
                  <option>Productividad</option><option>Programación</option><option>Aprendizaje</option><option>Colaboración</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="quest-difficulty">Dificultad</label>
                <select id="quest-difficulty" value={form.difficulty} onChange={event => setForm({ ...form, difficulty: event.target.value as QuestRecord['difficulty'] })}>
                  <option>Fácil</option><option>Media</option><option>Difícil</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="quest-due-date">Fecha límite</label>
                <input id="quest-due-date" type="date" value={form.due_at} onChange={event => setForm({ ...form, due_at: event.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="quest-reward">Recompensa XP</label>
                <input id="quest-reward" type="number" min={1} max={10000} value={form.reward_xp} onChange={event => setForm({ ...form, reward_xp: event.target.value })} required />
              </div>
            </div>
            <button className="button primary" type="submit" disabled={saving || !form.title.trim()}>
              {saving ? 'Creando…' : 'Crear y participar'}
            </button>
          </form>
        </section>
      )}

      {loading ? (
        <div className="panel loading-state" role="status" aria-live="polite">Cargando retos…</div>
      ) : !error && (
        <section className="gaming-section" aria-labelledby="quest-list-title">
          <div className="section-title">
            <div><span>DESAFÍOS ACTIVOS</span><h2 id="quest-list-title">Retos de la comunidad</h2></div>
            <span className="notification-summary">Página {page} de {lastPage}</span>
          </div>
          {quests.length ? (
            <ul className="quest-list">
              {quests.map(quest => (
                <li className="panel quest-card" key={quest.id}>
                  <div className="quest-card-header">
                    <span className="quest-icon"><Gamepad2 size={18} aria-hidden="true" /></span>
                    <div className="quest-heading-copy">
                      <span className="quest-category">{quest.category} · {quest.difficulty}</span>
                      <h3>{quest.title}</h3>
                    </div>
                    <span className="quest-reward"><Award size={14} aria-hidden="true" /> {quest.reward_xp} XP</span>
                  </div>
                  {quest.description && <p className="quest-description">{quest.description}</p>}
                  <div className="quest-meta">
                    <span><Users size={14} aria-hidden="true" /> {quest.participants_count} participantes</span>
                    <span><CalendarDays size={14} aria-hidden="true" /> {formatDate(quest.due_at)}</span>
                    <span>Creado por {quest.creator.name}</span>
                  </div>

                  {quest.joined ? (
                    <div className="quest-progress-area">
                      {quest.completed ? (
                        <p className="quest-completed"><Check size={15} aria-hidden="true" /> Completado</p>
                      ) : (
                        <form className="quest-progress-form" onSubmit={event => void handleProgress(event, quest)}>
                          <label htmlFor={`quest-progress-${quest.id}`}>Tu progreso autorreportado: {quest.my_progress ?? 0}%</label>
                          <div>
                            <input
                              id={`quest-progress-${quest.id}`}
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={progressDrafts[quest.id] ?? '0'}
                              onChange={event => setProgressDrafts(current => ({ ...current, [quest.id]: event.target.value }))}
                            />
                            <button className="button secondary" type="submit" disabled={busyQuest === quest.id}>
                              {busyQuest === quest.id ? 'Guardando…' : 'Guardar progreso'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : currentPublicId === quest.creator.public_id ? (
                    <p className="quest-owner-note">Este reto es tuyo. Para ganar XP, únete a un reto creado por otra persona.</p>
                  ) : (
                    <button className="button primary" type="button" onClick={() => void handleJoin(quest)} disabled={busyQuest === quest.id}>
                      {busyQuest === quest.id ? 'Uniéndote…' : 'Unirme al reto'} <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel dashboard-empty">
              <p>Aún no hay retos activos.</p>
              <button className="button secondary" type="button" onClick={() => setFormOpen(true)}>Crear el primero</button>
            </div>
          )}

          {lastPage > 1 && (
            <nav className="notification-pagination" aria-label="Páginas de retos">
              <button className="button secondary" type="button" disabled={page <= 1} onClick={() => void load(page - 1)}>Anterior</button>
              <span>{page} / {lastPage}</span>
              <button className="button secondary" type="button" disabled={page >= lastPage} onClick={() => void load(page + 1)}>Siguiente</button>
            </nav>
          )}
        </section>
      )}
    </section>
  );
}
