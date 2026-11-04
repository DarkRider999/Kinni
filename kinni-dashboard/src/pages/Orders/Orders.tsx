import { useState } from 'react';
import { Kanban, Table } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { lanes, statusLabel, statusTone } from '../../data/orders';
import type { Order, OrderStatus } from '../../types';
import KanbanBoard from './KanbanBoard';

interface Props { orders: Order[]; onMove: (id: string, status: OrderStatus) => void }

export default function Orders({ orders, onMove }: Props) {
  const [view, setView] = useState<'board' | 'table'>('board');
  const open = orders.filter((o) => o.status !== 'sent' && o.status !== 'cancelled').length;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="page-title">Packing board</h2>
          <div className="page-sub">{open} open orders · drag cards between lanes</div>
        </div>
        <div className="segmented">
          <button className={view === 'board' ? 'is-active' : ''} onClick={() => setView('board')}><Kanban size={12} /> Board</button>
          <button className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')}><Table size={12} /> Table</button>
        </div>
      </div>
      {view === 'board' ? <KanbanBoard orders={orders} onMove={onMove} /> : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th className="num">Items</th><th>Status</th><th className="num">Total</th><th>Move to</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.id}</td><td>{o.customer}</td><td className="muted">{o.placed}</td><td className="num">{o.items}</td>
                    <td><Badge tone={statusTone[o.status]}>{statusLabel[o.status]}</Badge></td>
                    <td className="num">{o.total}</td>
                    <td>
                      <select className="select" style={{ height: 28, width: 120 }} value={o.status} onChange={(e) => onMove(o.id, e.target.value as OrderStatus)}>
                        {lanes.map((l) => <option key={l.status} value={l.status}>{l.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
