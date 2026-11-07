import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { gsap } from 'gsap';
import { lanes } from '../../data/orders';
import type { Order, OrderStatus } from '../../types';
import OrderCard from './OrderCard';
import s from './Orders.module.css';

interface Props { orders: Order[]; onMove: (id: string, status: OrderStatus) => void }

const laneAt = (x: number, y: number): OrderStatus | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-lane]');
  return (el?.dataset.lane as OrderStatus | undefined) ?? null;
};

export default function KanbanBoard({ orders, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<OrderStatus | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>, order: Order) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-no-drag]')) return;
    const card = e.currentTarget;
    const startX = e.clientX, startY = e.clientY;
    let started = false;

    const begin = () => {
      started = true;
      const rect = card.getBoundingClientRect();
      const ghost = card.cloneNode(true) as HTMLElement;
      ghost.classList.add('ocard--ghost');
      Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
      document.body.appendChild(ghost);
      document.body.classList.add('is-dragging');
      ghostRef.current = ghost;
      gsap.fromTo(ghost, { scale: 1, rotation: 0 }, { scale: 1.04, rotation: -2, duration: 0.25, ease: 'back.out(2)' });
      setDragId(order.id);
    };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!started) { if (Math.hypot(dx, dy) < 5) return; begin(); }
      // Position relative to the mouse: the ghost keeps the grab offset.
      gsap.set(ghostRef.current, { x: dx, y: dy });
      setHoverLane(laneAt(ev.clientX, ev.clientY));
    };

    const finish = (ev: PointerEvent | null) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      cleanupRef.current = null;
      const ghost = ghostRef.current;
      ghostRef.current = null;
      document.body.classList.remove('is-dragging');
      setHoverLane(null);
      if (!started || !ghost) return;
      const target = ev ? laneAt(ev.clientX, ev.clientY) : null;
      if (target && target !== order.status) {
        onMove(order.id, target);
        setDragId(null);
        gsap.to(ghost, { opacity: 0, scale: 0.96, duration: 0.18, ease: 'power2.out', onComplete: () => ghost.remove() });
      } else {
        gsap.to(ghost, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.3, ease: 'power3.out', onComplete: () => { ghost.remove(); setDragId(null); } });
      }
    };
    const up = (ev: PointerEvent) => finish(ev);
    const cancel = () => finish(null);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    cleanupRef.current = () => { finish(null); ghostRef.current?.remove(); };
  }, [onMove]);

  return (
    <div className={s.board}>
      {lanes.map((lane) => {
        const list = orders.filter((o) => o.status === lane.status);
        return (
          <section key={lane.status} data-lane={lane.status} className={`${s.lane} ${hoverLane === lane.status && dragId ? s.laneHot : ''}`}>
            <header className={s.laneHead}>
              <span className={`${s.laneDot} ${s[`dot_${lane.status}`]}`} />
              <strong>{lane.label}</strong>
              <span className={s.laneCount}>{list.length}</span>
            </header>
            <div className={s.laneBody}>
              {list.map((o) => <OrderCard key={o.id} order={o} dragging={dragId === o.id} onPointerDown={onPointerDown} onMove={onMove} />)}
              {list.length === 0 && <div className={s.empty}>Drop orders here</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
