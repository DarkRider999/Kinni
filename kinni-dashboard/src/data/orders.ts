import type { Order, OrderStatus } from '../types';

export const initialOrders: Order[] = [
  { id: 'KL-49961', customer: "Dash d'Cream", items: 1, status: 'new', total: '$12.50', placed: '9:42 AM' },
  { id: 'KL-49902', customer: 'Bain Byer', items: 1, status: 'in_pack', total: '$22.00', placed: '8:15 AM' },
  { id: 'KL-49903', customer: 'Jafra Mazzini', items: 2, status: 'in_pack', total: '$35.22', placed: '8:03 AM' },
  { id: 'KL-49950', customer: 'Sofia Moreno', items: 2, status: 'packed', total: '$37.50', placed: '7:51 AM' },
  { id: 'KL-49908', customer: 'Yara Moreno', items: 2, status: 'packed', total: '$62.05', placed: '7:20 AM' },
  { id: 'KL-49957', customer: 'Omar Haddad', items: 1, status: 'packed', total: '$24.00', placed: '6:58 AM' },
  { id: 'KL-49904', customer: 'Jose Tarif', items: 3, status: 'sent', total: '$88.50', placed: 'Yesterday' },
  { id: 'KL-49951', customer: 'Thea Novak', items: 1, status: 'sent', total: '$62.50', placed: 'Yesterday' },
  { id: 'KL-49899', customer: 'Lena Ortiz', items: 1, status: 'cancelled', total: '$18.00', placed: 'Oct 30' },
];

export interface LaneDef {
  status: OrderStatus;
  label: string;
  /** Label of the blue action button on cards in this lane. */
  action: string;
  /** Lane the action moves the order to; null means the action reveals tracking instead. */
  next: OrderStatus | null;
}

export const lanes: LaneDef[] = [
  { status: 'new', label: 'New', action: 'Start packing', next: 'in_pack' },
  { status: 'in_pack', label: 'In pack', action: 'Mark packed', next: 'packed' },
  { status: 'packed', label: 'Packed', action: 'Send', next: 'sent' },
  { status: 'sent', label: 'Sent', action: 'Track', next: null },
  { status: 'cancelled', label: 'Cancelled', action: 'Restore', next: 'new' },
];

export const statusLabel: Record<OrderStatus, string> = {
  new: 'New',
  in_pack: 'In pack',
  packed: 'Packed',
  sent: 'Sent',
  cancelled: 'Cancelled',
};

export const statusTone: Record<OrderStatus, 'blue' | 'orange' | 'green' | 'teal' | 'red'> = {
  new: 'blue',
  in_pack: 'orange',
  packed: 'green',
  sent: 'teal',
  cancelled: 'red',
};
