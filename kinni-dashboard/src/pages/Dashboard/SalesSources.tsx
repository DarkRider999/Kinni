import { Globe, Instagram } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import s from './Dashboard.module.css';

const sources = [
  { label: 'Web store', pct: 64, amount: '$15,017', color: 'var(--blue)', icon: Globe },
  { label: 'Instagram', pct: 15, amount: '$3,518', color: 'var(--orange)', icon: Instagram },
];

export default function SalesSources() {
  const rest = 100 - sources.reduce((a, x) => a + x.pct, 0);
  return (
    <Card title="Where sales came from" subtitle="Last 30 days: $33,510">
      <div className={s.stack}>
        {sources.map((x) => <span key={x.label} title={`${x.label} ${x.pct}%`} style={{ width: `${x.pct}%`, background: x.color }} />)}
        <span title={`Other channels ${rest}%`} style={{ width: `${rest}%`, background: 'var(--teal)' }} />
      </div>
      <div className={s.list}>
        {sources.map(({ label, pct, amount, color, icon: Icon }) => (
          <div key={label} className={s.line}>
            <span className={s.srcIcon} style={{ color }}><Icon size={13} /></span>
            <div className={s.lineMain}><strong>{label}</strong></div>
            <span className="muted mono">{pct}%</span>
            <span className="mono">{amount}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
