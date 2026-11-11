import { useState } from 'react';
import { Download } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

type Status = 'Paid' | 'Pending' | 'Overdue';
const invoices: { id: string; client: string; issued: string; due: string; amount: string; status: Status }[] = [
  { id: 'INV-1042', client: 'Fern & Co. Café', issued: 'Oct 28', due: 'Nov 11', amount: '$1,240.00', status: 'Pending' },
  { id: 'INV-1041', client: 'Blue Door Bakery', issued: 'Oct 20', due: 'Nov 3', amount: '$486.50', status: 'Paid' },
  { id: 'INV-1040', client: 'Tidewater Market', issued: 'Oct 2', due: 'Oct 16', amount: '$932.00', status: 'Overdue' },
  { id: 'INV-1039', client: 'Hearth Yoga Studio', issued: 'Sep 30', due: 'Oct 14', amount: '$210.00', status: 'Paid' },
  { id: 'INV-1038', client: 'Copper Kettle Inn', issued: 'Sep 22', due: 'Oct 6', amount: '$1,780.25', status: 'Paid' },
];
const tone = { Paid: 'green', Pending: 'orange', Overdue: 'red' } as const;

export default function Invoices() {
  const [filter, setFilter] = useState<'All' | Status>('All');
  const list = invoices.filter((i) => filter === 'All' || i.status === filter);
  return (
    <div className="page">
      <div className="page-head">
        <div><h2 className="page-title">Invoices</h2><div className="page-sub">Wholesale accounts</div></div>
        <div className="segmented">
          {(['All', 'Paid', 'Pending', 'Overdue'] as const).map((f) => <button key={f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th className="num">Amount</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.id}</td><td>{i.client}</td><td className="muted">{i.issued}</td><td className="muted">{i.due}</td>
                  <td className="num">{i.amount}</td><td><Badge tone={tone[i.status]} dot>{i.status}</Badge></td>
                  <td><Button size="sm" variant="outline" iconOnly aria-label={`Download ${i.id}`} icon={<Download size={12} />} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
