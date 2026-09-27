import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Section({ title, subtitle, to, children }) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {to && <Link to={to}>Semua <ArrowUpRight size={15} /></Link>}
      </div>
      {children}
    </section>
  );
}
