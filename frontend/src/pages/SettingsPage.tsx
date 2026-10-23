import { Check, Copy, KeyRound, Shield, User as UserIcon } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updatePassword, updateProfile } from '../lib/api';
import type { User } from '../types';

export function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getProfile();
        setUser(data);
        setName(data.name || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || '');
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : 'Error al cargar perfil.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);

    try {
      const updated = await updateProfile({
        name: name.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setUser(updated);
      setProfileSuccess('Perfil actualizado correctamente.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');

    if (password.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== passwordConfirmation) {
      setPasswordError('La confirmación de la contraseña no coincide.');
      return;
    }

    setPasswordSaving(true);
    try {
      const message = await updatePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      navigate('/login', {
        replace: true,
        state: { notice: `${message} Inicia sesión con tu nueva contraseña.` },
      });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleCopyPublicId() {
    if (!user?.public_id) return;
    setCopyError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(user.public_id);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setCopiedId(false);
      setCopyError('No se pudo copiar. Selecciona el identificador para copiarlo manualmente.');
    }
  }

  if (loading) {
    return (
      <div className="view settings-view">
        <div className="panel loading-state" role="status" aria-live="polite">
          Cargando configuración…
        </div>
      </div>
    );
  }

  return (
    <section className="view settings-view" aria-labelledby="settings-heading">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / SISTEMA</span>
          <h1 id="settings-heading">Ajustes y perfil</h1>
          <p>Gestiona tu identidad en NEXORA y tus credenciales de acceso.</p>
        </div>
      </header>

      <div className="grid-2">
        {/* Profile Card */}
        <div className="card settings-card">
          <div className="section-title">
            <div>
              <span>IDENTIDAD</span>
              <h2><UserIcon size={18} aria-hidden="true" /> Perfil de Usuario</h2>
            </div>
          </div>

          {profileError && <div className="alert" role="alert">{profileError}</div>}
          {profileSuccess && <p className="notification-notice" role="status">{profileSuccess}</p>}

          <form onSubmit={handleProfileSubmit}>
            <div className="form-field">
              <label htmlFor="settings-name">Nombre completo</label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                maxLength={100}
                placeholder="Tu nombre"
              />
            </div>

            <div className="form-field">
              <label htmlFor="settings-email">Correo electrónico</label>
              <input
                id="settings-email"
                type="email"
                value={user?.email || ''}
                disabled
                aria-describedby="email-desc"
              />
              <small id="email-desc">El correo electrónico no se puede modificar.</small>
            </div>

            {user?.public_id && (
              <div className="form-field">
                <label htmlFor="settings-public-id">Identificador público</label>
                <div className="public-id-row">
                  <input
                    id="settings-public-id"
                    className="public-id-input"
                    type="text"
                    value={user.public_id}
                    readOnly
                    aria-describedby="public-id-desc"
                  />
                  <button
                    type="button"
                    className="button secondary icon-only"
                    onClick={() => void handleCopyPublicId()}
                    title="Copiar ID para compartir con amigos"
                    aria-label="Copiar identificador público"
                  >
                    {copiedId ? <Check size={14} className="copy-icon is-copied" /> : <Copy size={14} />}
                  </button>
                </div>
                {copyError && <small className="form-error" role="alert">{copyError}</small>}
                <small id="public-id-desc">Comparte este identificador con tus compañeros para que te agreguen como amigo.</small>
              </div>
            )}

            <div className="form-field">
              <label htmlFor="settings-avatar">URL del Avatar</label>
              <input
                id="settings-avatar"
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://ejemplo.com/avatar.png"
              />
            </div>

            <div className="form-field">
              <label htmlFor="settings-bio">Biografía</label>
              <textarea
                id="settings-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={255}
                rows={3}
                placeholder="Cuéntanos un poco sobre ti..."
              />
            </div>

            <button className="button primary" type="submit" disabled={profileSaving}>
              {profileSaving ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </form>
        </div>

        {/* Security / Password Card */}
        <div className="card settings-card">
          <div className="section-title">
            <div>
              <span>SEGURIDAD</span>
              <h2><Shield size={18} aria-hidden="true" /> Contraseña de Acceso</h2>
            </div>
          </div>

          {passwordError && <div className="alert" role="alert">{passwordError}</div>}
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-field">
              <label htmlFor="settings-current-pass">Contraseña actual</label>
              <input
                id="settings-current-pass"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <div className="form-field">
              <label htmlFor="settings-new-pass">Nueva contraseña</label>
              <input
                id="settings-new-pass"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="form-field">
              <label htmlFor="settings-confirm-pass">Confirmar nueva contraseña</label>
              <input
                id="settings-confirm-pass"
                type="password"
                value={passwordConfirmation}
                onChange={e => setPasswordConfirmation(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repite la nueva contraseña"
              />
            </div>

            <div className="callout info settings-callout">
              <KeyRound size={14} className="callout-icon" />
              <span>Por razones de seguridad, al actualizar tu clave se revocarán todos los tokens activos y deberás volver a iniciar sesión.</span>
            </div>

            <button className="button primary" type="submit" disabled={passwordSaving}>
              {passwordSaving ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
