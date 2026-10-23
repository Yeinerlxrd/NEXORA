import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear tu cuenta.');
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
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">Únete a tu comunidad de proyectos.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Nombre</label>
            <input id="name" autoComplete="name" maxLength={100} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="email" maxLength={255} value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="new-password" minLength={8} maxLength={255} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <div className="alert" role="alert">{error}</div>}

          <button type="submit" className="button primary" disabled={loading}>
            {loading ? 'Registrando…' : 'Registrar'}
          </button>
        </form>

        <p className="auth-alt">
          ¿Ya tienes una cuenta? <Link to="/login" className="auth-link">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
