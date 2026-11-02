import { apiSlice } from './apiSlice';

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProductionSummary: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/production/board',
      providesTags: [{ type: 'Dashboard', id: 'PRODUCTION' }],
    }),

    getOrdersSummary: builder.query<
      { success: boolean; data: any },
      { dateFrom?: string; dateTo?: string; from?: string; to?: string; clientId?: string } | void
    >({
      query: (params) => {
        const queryParams: any = {};
        if (params) {
          if (params.dateFrom || params.from) queryParams.dateFrom = params.dateFrom || params.from;
          if (params.dateTo || params.to) queryParams.dateTo = params.dateTo || params.to;
          if (params.clientId) queryParams.clientId = params.clientId;
        }
        return {
          url: '/orders/summary',
          params: queryParams,
        };
      },
      providesTags: [{ type: 'Dashboard', id: 'ORDERS' }],
    }),

    getDashboardStockSummary: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/stock/summary',
      providesTags: [{ type: 'Dashboard', id: 'STOCK' }],
    }),

    getAuditLogs: builder.query<
      { success: boolean; data: any[]; pagination?: any },
      { page?: number; limit?: number; entity?: string; action?: string } | void
    >({
      query: (params) => ({
        url: '/audit',
        params: params || {},
      }),
      providesTags: [{ type: 'Dashboard', id: 'AUDIT' }],
    }),
  }),
});

export const {
  useGetProductionSummaryQuery,
  useGetOrdersSummaryQuery,
  useGetDashboardStockSummaryQuery,
  useGetAuditLogsQuery,
} = dashboardApi;
