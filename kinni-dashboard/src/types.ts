export type RouteId =
  | 'home'
  | 'orders'
  | 'products'
  | 'analytics'
  | 'customers'
  | 'finances'
  | 'invoices'
  | 'discounts'
  | 'chats'
  | 'email'
  | 'apps'
  | 'settings';

export type OrderStatus = 'new' | 'in_pack' | 'packed' | 'sent' | 'cancelled';

export interface Order {
  id: string;
  customer: string;
  items: number;
  status: OrderStatus;
  total: string;
  placed: string;
}

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  reorderAt: number;
  status: ProductStatus;
  category: string;
  color: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  orders: number;
  spent: number;
  location: string;
  lastOrder: string;
  color: string;
}

export type BadgeTone = 'neutral' | 'green' | 'red' | 'blue' | 'orange' | 'teal';
