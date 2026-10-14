import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  accent?: ReactNode;
};

export function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="card stat-card">
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
      </div>
      {accent}
    </div>
  );
}
