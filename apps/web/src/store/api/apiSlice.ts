import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';
import { getAuthCookie } from '../../utils/cookieUtils';

const rawBaseQuery = fetchBaseQuery({
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

    if (!headers.has('Idempotency-Key') && !headers.has('idempotency-key')) {
      const generatedKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      headers.set('Idempotency-Key', generatedKey);
    }

    return headers;
  },
});

const customBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  if (typeof args !== 'string') {
    const method = (args.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const existingHeaders =
        args.headers instanceof Headers
          ? Object.fromEntries(args.headers.entries())
          : (args.headers as Record<string, string>) || {};

      if (!existingHeaders['Idempotency-Key'] && !existingHeaders['idempotency-key']) {
        const generatedKey =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        args = {
          ...args,
          headers: {
            ...existingHeaders,
            'Idempotency-Key': generatedKey,
          },
        };
      }
    }
  }
  return rawBaseQuery(args, api, extraOptions);
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: customBaseQuery,
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
