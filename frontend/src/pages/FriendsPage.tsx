import { Check, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  cancelFriendRequest,
  getFriendRequestsReceived,
  getFriendRequestsSent,
  getFriends,
  removeFriend,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
} from '../lib/api';
import type { FriendRequestRecord, PublicProfile } from '../types';
import { UserAvatar } from '../components/UserAvatar';

export function FriendsPage() {
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [received, setReceived] = useState<FriendRequestRecord[]>([]);
  const [sent, setSent] = useState<FriendRequestRecord[]>([]);
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [friendList, receivedRequests, sentRequests] = await Promise.all([
        getFriends(),
        getFriendRequestsReceived(),
        getFriendRequestsSent(),
      ]);
      setFriends(friendList);
      setReceived(receivedRequests);
      setSent(sentRequests);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información social.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSearching(true);
    setHasSearched(false);
    try {
      setResults(await searchUsers(query.trim()));
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar personas.');
    } finally {
      setSearching(false);
    }
  }

  async function performAction(key: string, action: () => Promise<void>, success: string) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      if (await refresh()) {
        setNotice(success);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(null);
    }
  }

  const friendIds = new Set(friends.map(friend => friend.public_id));
  const sentIds = new Set(sent.map(request => request.user.public_id));

  return (
    <section className="view social-view" aria-labelledby="friends-title">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / SOCIAL</span>
          <h1 id="friends-title">Amistades</h1>
          <p>Busca personas por su nombre o identificador público y gestiona tus vínculos.</p>
        </div>
        <div className="social-header-stats" aria-label="Resumen social">
          <span className="social-stat"><b>{friends.length}</b> amistades</span>
          <span className="social-stat"><b>{received.length}</b> por responder</span>
        </div>
      </header>

      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <p className="notification-notice" role="status">{notice}</p>}

      <section className="panel social-section friend-search-panel" aria-labelledby="friend-search-title">
        <div className="section-title">
          <div>
            <span>DIRECTORIO</span>
            <h2 id="friend-search-title">Buscar personas</h2>
          </div>
        </div>
        <form className="friend-search" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="friend-search-input">Buscar personas por nombre o identificador público</label>
          <input
            id="friend-search-input"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setHasSearched(false);
              if (results.length) setResults([]);
            }}
            minLength={2}
            maxLength={80}
            placeholder="Nombre o identificador público"
            required
          />
          <button className="button primary" type="submit" disabled={searching || query.trim().length < 2}>
            <Search size={15} aria-hidden="true" />
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </section>

      {hasSearched && !error && (
        <section className="panel social-section" aria-labelledby="search-results-title">
          <div className="section-title">
            <div>
              <span>RESULTADOS</span>
              <h2 id="search-results-title">Personas encontradas <span className="count-pill">{results.length}</span></h2>
            </div>
          </div>
          {results.length ? (
            <div className="social-section-body">
              <ul className="social-list">
                {results.map(profile => (
                  <li className="card social-card" key={profile.public_id}>
                    <ProfileSummary profile={profile} />
                    {friendIds.has(profile.public_id) ? (
                      <span className="social-status">Amistad</span>
                    ) : sentIds.has(profile.public_id) ? (
                      <span className="social-status">Solicitud enviada</span>
                    ) : (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void performAction(
                          `send-${profile.public_id}`,
                          () => sendFriendRequest(profile.public_id),
                          'Solicitud enviada.',
                        )}
                      >
                        <UserPlus size={14} aria-hidden="true" /> Agregar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="social-empty social-section-body">No se encontraron personas con esa búsqueda.</p>
          )}
        </section>
      )}

      {loading ? (
        <div className="card loading-state" role="status">Cargando amistades…</div>
      ) : !error && (
        <>
          <section className="panel social-section" aria-labelledby="requests-title">
            <div className="section-title">
              <div>
                <span>SOLICITUDES</span>
                <h2 id="requests-title">Recibidas <span className="count-pill">{received.length}</span></h2>
              </div>
            </div>
            {received.length ? (
              <div className="social-section-body">
                <ul className="social-list">
                  {received.map(request => (
                    <li className="card social-card" key={request.id}>
                      <ProfileSummary profile={request.user} />
                      <div className="social-actions">
                        <button
                          className="button primary"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void performAction(
                            `accept-${request.id}`,
                            () => respondToFriendRequest(request.id, 'accept'),
                            'Solicitud aceptada.',
                          )}
                        >
                          <Check size={14} aria-hidden="true" /> Aceptar
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void performAction(
                            `reject-${request.id}`,
                            () => respondToFriendRequest(request.id, 'reject'),
                            'Solicitud rechazada.',
                          )}
                        >
                          <X size={14} aria-hidden="true" /> Rechazar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="social-empty social-section-body">No tienes solicitudes pendientes.</p>}
          </section>

          <section className="panel social-section" aria-labelledby="sent-title">
            <div className="section-title">
              <div>
                <span>ENVIADAS</span>
                <h2 id="sent-title">Solicitudes enviadas <span className="count-pill">{sent.length}</span></h2>
              </div>
            </div>
            {sent.length ? (
              <div className="social-section-body">
                <ul className="social-list">
                  {sent.map(request => (
                    <li className="card social-card" key={request.id}>
                      <ProfileSummary profile={request.user} />
                      <button
                        className="button secondary"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void performAction(
                          `cancel-${request.id}`,
                          () => cancelFriendRequest(request.id),
                          'Solicitud cancelada.',
                        )}
                      >
                        Cancelar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="social-empty social-section-body">No has enviado solicitudes pendientes.</p>}
          </section>

          <section className="panel social-section" aria-labelledby="friends-list-title">
            <div className="section-title">
              <div>
                <span>CÍRCULO</span>
                <h2 id="friends-list-title">Mis amistades <span className="count-pill">{friends.length}</span></h2>
              </div>
            </div>
            {friends.length ? (
              <div className="social-section-body">
                <ul className="social-list">
                  {friends.map(friend => (
                    <li className="card social-card" key={friend.public_id}>
                      <ProfileSummary profile={friend} />
                      <button
                        className="button secondary"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar a ${friend.name} de tus amistades?`)) {
                            void performAction(
                              `remove-${friend.public_id}`,
                              () => removeFriend(friend.public_id),
                              'Amistad eliminada.',
                            );
                          }
                        }}
                      >
                        <UserMinus size={14} aria-hidden="true" /> Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="social-empty social-section-body">Todavía no tienes amistades.</p>}
          </section>
        </>
      )}
    </section>
  );
}

function ProfileSummary({ profile }: { profile: PublicProfile }) {
  return (
    <div className="social-profile">
      <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} />
      <span className="social-profile-copy">
        <b>{profile.name}</b>
        <small>{profile.bio || `ID público: ${profile.public_id.slice(0, 8)}…`}</small>
      </span>
    </div>
  );
}
