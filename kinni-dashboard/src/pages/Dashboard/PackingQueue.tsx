import { Kanban } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { navigate } from '../../router';
import type { Order } from '../../types';
import s from './Dashboard.module.css';

export default function PackingQueue({ orders }: { orders: Order[] }) {
  const packed = orders.filter((o) => o.status === 'packed');
  return (
    <Card title="Packing queue" subtitle={`${packed.length} orders paid and waiting`}
      action={<Button size="sm" variant="outline" icon={<Kanban size={12} />} onClick={() => navigate('orders')}>Board</Button>}>
      <div className={s.list}>
        {packed.slice(0, 2).map((o) => (
          <div key={o.id} className={s.line}>
            <div className={s.lineMain}><strong>{o.customer}</strong><small>{o.id} · {o.items} items</small></div>
            <span className="mono">{o.total}</span>
            <Badge tone="green">Packed</Badge>
          </div>
        ))}
        {packed.length === 0 && <div className="faint">Nothing waiting. Nice.</div>}
      </div>
    </Card>
  );
}
