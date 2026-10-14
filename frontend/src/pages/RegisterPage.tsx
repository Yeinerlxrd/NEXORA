import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear tu cuenta.');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <div className="brand-mark">N</div>
          <span>NEXORA</span>
        </div>
        <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Crear cuenta</h1>
        <p style={{ textAlign: 'center', color: '#9aa6bd', marginBottom: 24 }}>Únete a tu comunidad de proyectos.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Nombre</label>
            <input id="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <div className="alert">{error}</div>}

          <button type="submit" className="button primary" style={{ width: '100%' }}>Registrar</button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, color: '#9aa6bd' }}>
          ¿Ya tienes una cuenta? <Link to="/login" style={{ color: '#22d3ee', fontWeight: 700 }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
