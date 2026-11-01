import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;
      const token = state.auth?.token || localStorage.getItem('loompilot_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'Auth',
    'Order',
    'Product',
    'Material',
    'Machine',
    'Supplier',
    'Stock',
    'Supervisor',
    'Production',
    'Quotation',
    'Client',
    'User',
    'Notification',
    'Dashboard',
    'Payment',
    'AI',
  ],
  endpoints: () => ({}),
});

