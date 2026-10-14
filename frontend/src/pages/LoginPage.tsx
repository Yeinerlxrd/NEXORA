import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        <div className="brand" style={{ justifyContent: 'center' }}>
          <div className="brand-mark">N</div>
          <span>NEXORA</span>
        </div>
        <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Bienvenido</h1>
        <p style={{ textAlign: 'center', color: '#9aa6bd', marginBottom: 24 }}>Accede a tu centro de operaciones.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <div className="alert">{error}</div>}

          <button type="submit" className="button primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, color: '#9aa6bd' }}>
          ¿No tienes cuenta? <Link to="/register" style={{ color: '#22d3ee', fontWeight: 700 }}>Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
