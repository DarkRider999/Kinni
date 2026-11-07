import { TrendingUp } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import s from './Dashboard.module.css';

interface Props { label: string; value: string; delta: string; spark?: number[] }

export default function StatCard({ label, value, delta, spark }: Props) {
  let path = '';
  if (spark) {
    const max = Math.max(...spark), min = Math.min(...spark);
    path = spark.map((v, i) => `${(i / (spark.length - 1)) * 80},${26 - ((v - min) / (max - min || 1)) * 22}`).join(' ');
  }
  return (
    <section className={`card ${s.stat}`}>
      <div className="stat-label">{label}</div>
      <div className={s.statRow}>
        <div className="stat-value">{value}</div>
        {spark && (
          <svg width="80" height="28" className={s.spark} aria-hidden>
            <polyline points={path} fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <Badge tone="green" icon={<TrendingUp size={11} />}>{delta}</Badge>
    </section>
  );
}
