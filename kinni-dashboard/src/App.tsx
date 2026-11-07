import { useCallback, useEffect, useState } from 'react';
import { ROUTE_LABELS, useHashRoute } from './router';
import Sidebar from './components/Sidebar/Sidebar';
import Header from './components/Header/Header';
import RightPanel from './components/RightPanel/RightPanel';
import Dashboard from './pages/Dashboard/Dashboard';
import Orders from './pages/Orders/Orders';
import Products from './pages/Products';
import Analytics from './pages/Analytics';
import Customers from './pages/Customers';
import Finances from './pages/Finances';
import Invoices from './pages/Invoices';
import Discounts from './pages/Discounts';
import Chats from './pages/Chats';
import Email from './pages/Email';
import Apps from './pages/Apps';
import Settings from './pages/Settings';
import { initialOrders } from './data/orders';
import type { Order, OrderStatus } from './types';

export default function App() {
  const route = useHashRoute();
  const [dark, setDark] = useState(true);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', 'light');
  }, [dark]);

  const moveOrder = useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) => {
      const target = prev.find((o) => o.id === id);
      if (!target || target.status === status) return prev;
      // Moved cards go to the top of their new lane.
      return [{ ...target, status }, ...prev.filter((o) => o.id !== id)];
    });
  }, []);

  let page;
  switch (route) {
    case 'home':
      page = <Dashboard orders={orders} />;
      break;
    case 'orders':
      page = <Orders orders={orders} onMove={moveOrder} />;
      break;
    case 'products':
      page = <Products />;
      break;
    case 'analytics':
      page = <Analytics />;
      break;
    case 'customers':
      page = <Customers />;
      break;
    case 'finances':
      page = <Finances />;
      break;
    case 'invoices':
      page = <Invoices />;
      break;
    case 'discounts':
      page = <Discounts />;
      break;
    case 'chats':
      page = <Chats />;
      break;
    case 'email':
      page = <Email />;
      break;
    case 'apps':
      page = <Apps />;
      break;
    case 'settings':
      page = <Settings />;
      break;
  }

  return (
    <div className="app">
      <Sidebar route={route} dark={dark} onToggleDark={() => setDark((d) => !d)} />
      <main className="app-main">
        <Header pageLabel={ROUTE_LABELS[route]} />
        <div key={route}>{page}</div>
      </main>
      <RightPanel open={route === 'home'} />
    </div>
  );
}
