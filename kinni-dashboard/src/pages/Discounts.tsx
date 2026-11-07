import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface Discount { code: string; kind: 'percent' | 'flat'; value: number; expires: string; used: number; limit: number }
const seed: Discount[] = [
  { code: 'STEEP15', kind: 'percent', value: 15, expires: 'Nov 30', used: 84, limit: 200 },
  { code: 'WELCOME5', kind: 'flat', value: 5, expires: 'Never', used: 312, limit: 0 },
  { code: 'MATCHA20', kind: 'percent', value: 20, expires: 'Nov 8', used: 47, limit: 50 },
  { code: 'FALLTEA', kind: 'flat', value: 10, expires: 'Oct 31', used: 120, limit: 120 },
];

export default function Discounts() {
  const [list, setList] = useState(seed);
  const [form, setForm] = useState<{ code: string; kind: 'percent' | 'flat'; value: string } | null>(null);
  const save = () => {
    if (!form || !form.code.trim()) return;
    setList((l) => [{ code: form.code.trim().toUpperCase(), kind: form.kind, value: Number(form.value) || 0, expires: 'Never', used: 0, limit: 0 }, ...l]);
    setForm(null);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h2 className="page-title">Discounts</h2><div className="page-sub">{list.length} codes</div></div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setForm({ code: '', kind: 'percent', value: '' })}>New discount</Button>
      </div>
      {form && (
        <Card title="New discount code">
          <div className="grid-3">
            <div className="field"><label>Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SPRING10" /></div>
            <div className="field"><label>Type</label><select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'percent' | 'flat' })}><option value="percent">Percentage</option><option value="flat">Flat amount</option></select></div>
            <div className="field"><label>Value</label><input className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="10" /></div>
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" onClick={save}>Create code</Button></div>
        </Card>
      )}
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Discount</th><th>Expires</th><th className="num">Used</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((d) => {
                const done = d.expires === 'Oct 31' || (d.limit > 0 && d.used >= d.limit);
                return (
                  <tr key={d.code}>
                    <td className="mono" style={{ fontWeight: 600 }}>{d.code}</td>
                    <td>{d.kind === 'percent' ? `${d.value}% off` : `$${d.value} off`}</td>
                    <td className="muted">{d.expires}</td>
                    <td className="num">{d.used}{d.limit ? ` / ${d.limit}` : ''}</td>
                    <td><Badge tone={done ? 'neutral' : 'green'} dot>{done ? 'Ended' : 'Active'}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
