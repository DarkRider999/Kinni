import type { Product } from '../types';

export const products: Product[] = [
  { id: 'p1', name: 'Ceremonial Matcha', sku: 'KL-MAT-030', price: 34, inventory: 128, reorderAt: 30, status: 'active', category: 'Green tea', color: '#22C55E' },
  { id: 'p2', name: 'Bergamot Grey', sku: 'KL-BGR-100', price: 16.5, inventory: 0, reorderAt: 40, status: 'active', category: 'Black tea', color: '#8B5CF6' },
  { id: 'p3', name: 'Milk Oolong', sku: 'KL-MOL-050', price: 21, inventory: 3, reorderAt: 20, status: 'active', category: 'Oolong', color: '#F59E0B' },
  { id: 'p4', name: 'Jasmine Pearls', sku: 'KL-JSP-050', price: 24, inventory: 46, reorderAt: 15, status: 'active', category: 'Green tea', color: '#14B8A6' },
  { id: 'p5', name: 'Chamomile Calm', sku: 'KL-CHM-075', price: 12.5, inventory: 72, reorderAt: 25, status: 'draft', category: 'Herbal', color: '#EAB308' },
];

/** Products at or below their reorder point. */
export const lowStock = (list: Product[]): Product[] =>
  list.filter((p) => p.inventory <= p.reorderAt).sort((a, b) => a.inventory - b.inventory);
