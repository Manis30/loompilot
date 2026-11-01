import { apiSlice } from './apiSlice';

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProductionSummary: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/production/board',
      providesTags: [{ type: 'Dashboard', id: 'PRODUCTION' }],
    }),

    getOrdersSummary: builder.query<{ success: boolean; data: any }, { from?: string; to?: string } | void>({
      query: (params) => ({
        url: '/orders/summary',
        params: params || {},
      }),
      providesTags: [{ type: 'Dashboard', id: 'ORDERS' }],
    }),

    getDashboardStockSummary: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/stock/summary',
      providesTags: [{ type: 'Dashboard', id: 'STOCK' }],
    }),
  }),
});

export const {
  useGetProductionSummaryQuery,
  useGetOrdersSummaryQuery,
  useGetDashboardStockSummaryQuery,
} = dashboardApi;
