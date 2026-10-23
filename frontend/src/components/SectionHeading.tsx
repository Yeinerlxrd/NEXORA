import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  id: string;
  to?: string;
  action?: string;
};

export function SectionHeading({ eyebrow, title, id, to, action }: SectionHeadingProps) {
  return (
    <div className="section-title">
      <div>
        <span>{eyebrow}</span>
        <h2 id={id}>{title}</h2>
      </div>
      {to && action ? (
        <Link to={to}>
          {action}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
