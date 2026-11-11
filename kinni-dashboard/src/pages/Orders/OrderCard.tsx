import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical, Truck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { lanes, statusLabel, statusTone } from '../../data/orders';
import type { Order, OrderStatus } from '../../types';
import s from './Orders.module.css';

interface Props {
  order: Order;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>, order: Order) => void;
  onMove: (id: string, status: OrderStatus) => void;
}

export default function OrderCard({ order, dragging, onPointerDown, onMove }: Props) {
  const [tracking, setTracking] = useState(false);
  const lane = lanes.find((l) => l.status === order.status)!;
  const act = () => (lane.next ? onMove(order.id, lane.next) : setTracking((t) => !t));
  return (
    <article className={`${s.ocard} ${dragging ? s.placeholder : ''}`} data-order={order.id} onPointerDown={(e) => onPointerDown(e, order)}>
      <div className={s.cardTop}>
        <span className={s.oid}>{order.id}</span>
        <GripVertical size={13} className={s.grip} />
      </div>
      <div className={s.customer}>{order.customer}</div>
      <div className={s.meta}>{order.items} {order.items === 1 ? 'item' : 'items'} · {order.placed}</div>
      <div className={s.cardFoot}>
        <Badge tone={statusTone[order.status]}>{statusLabel[order.status]}</Badge>
        <strong className="mono">{order.total}</strong>
      </div>
      {tracking && <div className={s.tracking}><Truck size={12} /> In transit · USPS 9400 1118 {order.id.slice(3)}</div>}
      <button className={`btn btn--primary btn--sm ${s.action}`} data-no-drag onClick={act}>{tracking ? 'Hide tracking' : lane.action}</button>
    </article>
  );
}
