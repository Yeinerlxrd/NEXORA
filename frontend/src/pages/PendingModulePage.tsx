import { ArrowUpRight, CircleDashed } from 'lucide-react';
import { Link } from 'react-router-dom';

const moduleDetails: Record<string, { description: string; status: string }> = {
  Daily: {
    description: 'La agenda personal, los hábitos y los objetivos todavía no tienen API ni persistencia propia.',
    status: 'Backend pendiente',
  },
  Social: {
    description: 'Amistades, comunidades y presencia requieren modelos, permisos y operaciones de API antes de habilitarse.',
    status: 'Backend pendiente',
  },
  Gaming: {
    description: 'La biblioteca y las sesiones de juego del diseño aún no cuentan con datos ni operaciones reales.',
    status: 'Backend pendiente',
  },
  Discord: {
    description: 'La vinculación OAuth y las notificaciones de Discord no están implementadas. No se muestra una conexión simulada.',
    status: 'Integración pendiente',
  },
  Notificaciones: {
    description: 'El dashboard puede mostrar notificaciones existentes; filtros, preferencias y acciones todavía no tienen API.',
    status: 'Interfaz pendiente',
  },
  Ajustes: {
    description: 'El perfil tiene operaciones disponibles en la API, pero la pantalla de ajustes todavía no está implementada.',
    status: 'Interfaz pendiente',
  },
};

export function PendingModulePage({ module }: { module: string }) {
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
