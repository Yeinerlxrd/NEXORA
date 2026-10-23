import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const notice = typeof location.state === 'object'
    && location.state !== null
    && 'notice' in location.state
    && typeof location.state.notice === 'string'
    ? location.state.notice
    : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">N</div>
          <span>NEXORA</span>
        </div>
        <h1 className="auth-title">Bienvenido</h1>
        <p className="auth-subtitle">Accede a tu centro de operaciones.</p>

        {notice && <p className="notification-notice" role="status">{notice}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="email" maxLength={255} value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <div className="alert" role="alert">{error}</div>}

          <button type="submit" className="button primary" disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-alt">
          ¿No tienes cuenta? <Link to="/register" className="auth-link">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
