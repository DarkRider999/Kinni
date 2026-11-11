import type { Customer } from '../types';

export const customers: Customer[] = [
  { id: 'c1', name: 'Sofia Moreno', email: 'sofia.moreno@mail.com', orders: 14, spent: 612.4, location: 'Austin, TX', lastOrder: 'Nov 1', color: '#3B82F6' },
  { id: 'c2', name: 'Yara Moreno', email: 'yara@moreno.studio', orders: 9, spent: 455.1, location: 'Brooklyn, NY', lastOrder: 'Nov 1', color: '#8B5CF6' },
  { id: 'c3', name: 'Jose Tarif', email: 'jose.tarif@gmail.com', orders: 21, spent: 1288.75, location: 'San Diego, CA', lastOrder: 'Oct 31', color: '#F59E0B' },
  { id: 'c4', name: 'Thea Novak', email: 'thea.novak@proton.me', orders: 6, spent: 301.5, location: 'Portland, OR', lastOrder: 'Oct 31', color: '#14B8A6' },
  { id: 'c5', name: 'Jafra Mazzini', email: 'jafra@mazzini.it', orders: 3, spent: 98.22, location: 'Chicago, IL', lastOrder: 'Nov 1', color: '#EF4444' },
  { id: 'c6', name: 'Bain Byer', email: 'bain.byer@outlook.com', orders: 11, spent: 540.0, location: 'Denver, CO', lastOrder: 'Nov 1', color: '#22C55E' },
];
