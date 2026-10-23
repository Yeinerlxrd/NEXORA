import { Bell, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api';
import type { NotificationRecord, PaginatedResponse } from '../types';

export function NotificationsPage() {
  const [result, setResult] = useState<PaginatedResponse<NotificationRecord> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError('');

    try {
      const [notifications, unread] = await Promise.all([
        getNotifications(requestedPage),
        getUnreadNotificationCount(),
      ]);
      setResult(notifications);
      setUnreadCount(unread);
      setPage(notifications.current_page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las notificaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(page);
  }, [page, refresh]);

  async function handleMarkRead(notificationId: number) {
    setBusy(notificationId);
    setError('');
    setNotice('');

    try {
      const updated = await markNotificationRead(notificationId);
      setResult(current => current && ({
        ...current,
        data: current.data.map(notification => notification.id === updated.id ? updated : notification),
      }));
      setUnreadCount(count => Math.max(0, count - 1));
      setNotice('Notificación marcada como leída.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la notificación.');
    } finally {
      setBusy(null);
    }
  }

  async function handleMarkAllRead() {
    setBusy('all');
    setError('');
    setNotice('');

    try {
      await markAllNotificationsRead();
      setResult(current => current && ({
        ...current,
        data: current.data.map(notification => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      }));
      setUnreadCount(0);
      setNotice('Todas las notificaciones están leídas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar las notificaciones.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="view notifications-view" aria-labelledby="notifications-title">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / SISTEMA</span>
          <h1 id="notifications-title">Notificaciones</h1>
          <p aria-live="polite">
            {unreadCount === 1 ? 'Tienes 1 notificación pendiente.' : `Tienes ${unreadCount} notificaciones pendientes.`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            className="button secondary"
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={busy !== null}
          >
            <CheckCheck size={15} aria-hidden="true" />
            Marcar todas como leídas
          </button>
        )}
      </header>

      {error && (
        <div className="alert" role="alert">
          {error}
          <button className="button secondary notification-action" type="button" onClick={() => void refresh(page)}>
            Reintentar
          </button>
        </div>
      )}
      {notice && <p className="notification-notice" role="status">{notice}</p>}

      {loading ? (
        <div className="card loading-state" role="status" aria-live="polite">
          Cargando notificaciones…
        </div>
      ) : !error && result?.data.length ? (
        <>
          <ul className="notification-list">
            {result.data.map(notification => (
              <li className={`card notification-card ${notification.read_at ? 'is-read' : 'is-unread'}`} key={notification.id}>
                <span className="notification-marker" aria-hidden="true">
                  <Bell size={15} />
                </span>
                <div className="notification-copy">
                  <h2>{notification.title}</h2>
                  <p>{notification.message}</p>
                  <time dateTime={notification.created_at}>
                    {new Date(notification.created_at).toLocaleString('es')}
                  </time>
                </div>
                {!notification.read_at && (
                  <button
                    className="button secondary notification-action"
                    type="button"
                    onClick={() => void handleMarkRead(notification.id)}
                    disabled={busy !== null}
                    aria-label={`Marcar como leída: ${notification.title}`}
                  >
                    {busy === notification.id ? 'Actualizando…' : 'Marcar leída'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <nav className="notification-pagination" aria-label="Paginación de notificaciones">
            <button
              className="button secondary"
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Anterior
            </button>
            <span aria-live="polite">Página {page} de {result.last_page}</span>
            <button
              className="button secondary"
              type="button"
              onClick={() => setPage(current => Math.min(result.last_page, current + 1))}
              disabled={page >= result.last_page || loading}
            >
              Siguiente
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </>
      ) : (
        !error && (
          <div className="card notification-empty">
            <Bell size={22} aria-hidden="true" />
            <p>No tienes notificaciones todavía.</p>
          </div>
        )
      )}
    </section>
  );
}
