import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { formatMoney, initials } from '../config';
import { customers } from '../data/customers';

export default function Customers() {
  const [q, setQ] = useState('');
  const list = customers.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <div className="page-head">
        <div><h2 className="page-title">Customers</h2><div className="page-sub">{customers.length} customers · {formatMoney(customers.reduce((a, c) => a + c.spent, 0))} lifetime</div></div>
        <div className="row" style={{ width: 240, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: 30 }} placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Customer</th><th>Email</th><th>Location</th><th className="num">Orders</th><th className="num">Total spent</th><th>Last order</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><div className="row"><span className="avatar" style={{ background: c.color }}>{initials(c.name)}</span><strong style={{ fontWeight: 500 }}>{c.name}</strong></div></td>
                  <td className="muted">{c.email}</td><td className="muted">{c.location}</td>
                  <td className="num">{c.orders}</td><td className="num">{formatMoney(c.spent, 2)}</td><td className="muted">{c.lastOrder}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="faint">No customers match “{q}”.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
