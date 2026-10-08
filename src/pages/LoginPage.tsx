import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authErrorMessage, useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user && !loading) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(authErrorMessage((err as { code?: string }).code ?? ''));
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={onSubmit}>
        <div className="login__brand">
          <img src="./favicon.svg" alt="" width={40} height={40} />
          <div>
            <h1>CRM Comercial</h1>
            <p className="muted">Inicia sesión para continuar</p>
          </div>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <button className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? <Spinner size={16} /> : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
