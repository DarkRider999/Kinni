import { useEffect, useState } from 'react';
import type { RouteId } from './types';

export const ROUTES: RouteId[] = [
  'home',
  'orders',
  'products',
  'analytics',
  'customers',
  'finances',
  'invoices',
  'discounts',
  'chats',
  'email',
  'apps',
  'settings',
];

export const ROUTE_LABELS: Record<RouteId, string> = {
  home: 'Dashboard',
  orders: 'Orders',
  products: 'Products',
  analytics: 'Analytics',
  customers: 'Customers',
  finances: 'Finances',
  invoices: 'Invoices',
  discounts: 'Discounts',
  chats: 'Chats',
  email: 'Email',
  apps: 'Apps',
  settings: 'Settings',
};

function readRoute(): RouteId {
  const raw = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as string[]).includes(raw) ? (raw as RouteId) : 'home';
}

export function navigate(route: RouteId) {
  window.location.hash = `#/${route}`;
}

export function useHashRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(readRoute);
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/home');
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

