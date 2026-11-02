import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';
import { getAuthCookie } from '../../utils/cookieUtils';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;
      const token =
        state.auth?.token ||
        (typeof window !== 'undefined' ? localStorage.getItem('loompilot_token') : null) ||
        getAuthCookie('loompilot_token') ||
        getAuthCookie('access_token');
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
    'MarketPrice',
  ],
  endpoints: () => ({}),
});
