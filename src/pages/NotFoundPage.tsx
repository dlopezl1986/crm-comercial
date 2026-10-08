import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="card">
      <h2>Página no encontrada</h2>
      <p className="muted">La dirección no existe.</p>
      <Link to="/" className="btn btn--secondary">Volver al dashboard</Link>
    </div>
  );
}
