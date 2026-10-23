import { ArrowUpRight, CircleDashed } from 'lucide-react';
import { Link } from 'react-router-dom';

const moduleDetails = {
  Discord: {
    description: 'La vinculación OAuth y las notificaciones de Discord no están implementadas. No se muestra una conexión simulada.',
    status: 'Integración pendiente',
  },
};

export function PendingModulePage({ module }: { module: keyof typeof moduleDetails }) {
  const details = moduleDetails[module];

  return (
    <section className="view pending-view" aria-labelledby="pending-title">
      <div className="welcome">
        <div>
          <span className="date-label">NEXORA / {module.toUpperCase()}</span>
          <h1 id="pending-title">{module}</h1>
          <p>Este módulo forma parte de la navegación prevista para NEXORA.</p>
        </div>
      </div>

      <div className="panel pending-panel">
        <span className="pending-icon"><CircleDashed size={22} /></span>
        <span className="pending-status">{details.status}</span>
        <h2>En preparación</h2>
        <p>{details.description}</p>
        <Link className="text-link" to="/">
          Volver al Core <ArrowUpRight size={15} />
        </Link>
      </div>
    </section>
  );
}
