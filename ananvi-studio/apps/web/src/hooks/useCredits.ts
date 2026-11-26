import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';

export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: () => api.get('/billing/credits').then(r => r.data.data),
  });
}

export function useTransactions(page = 1) {
  return useQuery({
    queryKey: ['transactions', page],
    queryFn: () => api.get('/billing/transactions', { params: { page } }).then(r => r.data),
  });
}

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get('/billing/packages').then(r => r.data.data),
    staleTime: Infinity,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (packageId: string) =>
      api.post('/billing/checkout', { package_id: packageId }).then(r => r.data.data),
  });
}
