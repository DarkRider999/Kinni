import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatMoney } from '../config';
import { products as seed } from '../data/products';
import type { Product } from '../types';

const tone = { active: 'green', draft: 'orange', archived: 'neutral' } as const;
const swatches = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#14B8A6'];

export default function Products() {
  const [list, setList] = useState<Product[]>(seed);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', price: '', inventory: '' });
  const add = () => {
    if (!form.name.trim()) return;
    setList((l) => [...l, { id: `p${Date.now()}`, name: form.name.trim(), sku: form.sku || `KL-NEW-${l.length + 1}`, price: Number(form.price) || 0,
      inventory: Number(form.inventory) || 0, reorderAt: 10, status: 'draft', category: 'New', color: swatches[l.length % swatches.length] }]);
    setForm({ name: '', sku: '', price: '', inventory: '' });
    setAdding(false);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h2 className="page-title">Products</h2><div className="page-sub">{list.length} products · {list.filter((p) => p.inventory <= p.reorderAt).length} need restocking</div></div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding((a) => !a)}>Add product</Button>
      </div>
      {adding && (
        <Card title="New product">
          <div className="grid-4">
            {(['name', 'sku', 'price', 'inventory'] as const).map((k) => (
              <div className="field" key={k}><label>{k[0].toUpperCase() + k.slice(1)}</label>
                <input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" onClick={add}>Save product</Button>
          </div>
        </Card>
      )}
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Name</th><th>SKU</th><th className="num">Price</th><th className="num">Inventory</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><span className="avatar" style={{ borderRadius: 8, background: `linear-gradient(135deg, ${p.color}, ${p.color}88)` }}>{p.name[0]}</span></td>
                  <td><strong style={{ fontWeight: 500 }}>{p.name}</strong><div className="faint" style={{ fontSize: 11 }}>{p.category}</div></td>
                  <td className="mono muted">{p.sku}</td>
                  <td className="num">{formatMoney(p.price, 2)}</td>
                  <td className="num" style={{ color: p.inventory <= p.reorderAt ? 'var(--orange)' : undefined }}>{p.inventory}</td>
                  <td><Badge tone={tone[p.status]}>{p.status[0].toUpperCase() + p.status.slice(1)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
