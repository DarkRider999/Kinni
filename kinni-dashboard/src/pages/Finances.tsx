import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

const summary = [
  { label: 'Gross sales, Oct', value: '$24,677', delta: '+8.2%', tone: 'green' as const },
  { label: 'Net payouts', value: '$22,915', delta: '+7.9%', tone: 'green' as const },
  { label: 'Processing fees', value: '$741', delta: '3.0%', tone: 'neutral' as const },
  { label: 'Refunds', value: '$1,021', delta: '-12%', tone: 'red' as const },
];
const txns = [
  { id: 'TX-8821', date: 'Nov 1', desc: 'Payout to •••• 4021', type: 'Payout', amount: -1842.1 },
  { id: 'TX-8820', date: 'Nov 1', desc: 'Order KL-49961', type: 'Sale', amount: 12.5 },
  { id: 'TX-8819', date: 'Oct 31', desc: 'Order KL-49904', type: 'Sale', amount: 88.5 },
  { id: 'TX-8818', date: 'Oct 31', desc: 'Refund KL-49899', type: 'Refund', amount: -18 },
  { id: 'TX-8817', date: 'Oct 30', desc: 'Stripe fees (Oct 30)', type: 'Fee', amount: -24.31 },
  { id: 'TX-8816', date: 'Oct 30', desc: 'Order KL-49951', type: 'Sale', amount: 62.5 },
];
const typeTone = { Payout: 'blue', Sale: 'green', Refund: 'red', Fee: 'orange' } as const;

export default function Finances() {
  return (
    <div className="page">
      <div className="page-head"><div><h2 className="page-title">Finances</h2><div className="page-sub">Next payout Tuesday, November 3</div></div></div>
      <div className="grid-4">
        {summary.map((x) => <Card key={x.label}><div className="stat-label">{x.label}</div><div className="stat-value">{x.value}</div><Badge tone={x.tone}>{x.delta}</Badge></Card>)}
      </div>
      <Card title="Transactions" subtitle="Most recent first">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Date</th><th>Description</th><th>Type</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td className="mono muted">{t.id}</td><td className="muted">{t.date}</td><td>{t.desc}</td>
                  <td><Badge tone={typeTone[t.type as keyof typeof typeTone]}>{t.type}</Badge></td>
                  <td className="num" style={{ color: t.amount < 0 ? 'var(--text-secondary)' : 'var(--green)' }}>{t.amount < 0 ? '–' : '+'}${Math.abs(t.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
