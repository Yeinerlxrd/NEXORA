import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  accent?: ReactNode;
};

export function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="card stat-card">
      <dl className="stat-card-copy">
        <dt className="label">{label}</dt>
        <dd className="value">{value}</dd>
      </dl>
      {accent && <span className="stat-card-icon">{accent}</span>}
    </div>
  );
}
