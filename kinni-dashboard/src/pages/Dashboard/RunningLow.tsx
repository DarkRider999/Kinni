import { useState } from 'react';
import { Boxes } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { lowStock, products } from '../../data/products';
import { navigate } from '../../router';
import s from './Dashboard.module.css';

export default function RunningLow() {
  const [ordered, setOrdered] = useState<Set<string>>(new Set());
  return (
    <Card title="Running low" subtitle="At or below their reorder point"
      action={<Button size="sm" variant="outline" icon={<Boxes size={12} />} onClick={() => navigate('products')}>Stock</Button>}>
      <div className={s.list}>
        {lowStock(products).slice(0, 2).map((p) => (
          <div key={p.id} className={s.line}>
            <span className={s.swatch} style={{ background: p.color }} />
            <div className={s.lineMain}><strong>{p.name}</strong><small>{p.inventory} left · reorder at {p.reorderAt}</small></div>
            <Button size="sm" variant="warn" disabled={ordered.has(p.id)} onClick={() => setOrdered((o) => new Set(o).add(p.id))}>
              {ordered.has(p.id) ? 'Ordered' : 'Restock'}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
