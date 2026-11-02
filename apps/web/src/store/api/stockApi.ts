import { apiSlice } from './apiSlice';

export const stockApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getStockBalances: builder.query<{ success: boolean; data: any[]; pagination?: any }, any>({
      query: (params) => ({
        url: '/stock/balances',
        params: params || {},
      }),
      providesTags: [{ type: 'Stock', id: 'BALANCES' }],
    }),

    getStockSummary: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/stock/summary',
      providesTags: [{ type: 'Stock', id: 'SUMMARY' }],
    }),

    getStockMovements: builder.query<
      {
        success: boolean;
        data: any[];
        meta?: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      },
      { materialId?: string; type?: string; orderId?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/stock/movements',
        params: params || {},
      }),
      transformResponse: (response: any) => {
        if (Array.isArray(response)) {
          return { success: true, data: response };
        }
        return {
          success: true,
          data: response?.data || [],
          meta: response?.meta,
        };
      },
      providesTags: [{ type: 'Stock', id: 'MOVEMENTS' }],
    }),

    recordGoodsReceipt: builder.mutation<
      {
        success: boolean;
        data: {
          materialId: string;
          materialName: string;
          stockQty: number;
          reservedQty: number;
          available: number;
          movementId: string;
        };
      },
      {
        materialId: string;
        qty: number;
        unitCostPaise: number;
        supplierId: string;
        orderId?: string;
        purchaseDecisionId?: string;
        idempotencyKey?: string;
      }
    >({
      query: ({ idempotencyKey, ...body }) => {
        const idempKey =
          idempotencyKey ||
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `idem-rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
        return {
          url: '/stock/receipt',
          method: 'POST',
          body,
          headers: {
            'Idempotency-Key': idempKey,
          },
        };
      },
      transformResponse: (response: any) => ({
        success: true,
        data: response?.data || response,
      }),
      invalidatesTags: [
        { type: 'Stock', id: 'BALANCES' },
        { type: 'Stock', id: 'SUMMARY' },
        { type: 'Stock', id: 'MOVEMENTS' },
        { type: 'Stock', id: 'PURCHASE_DECISIONS' },
        { type: 'Material', id: 'LIST' },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    adjustStock: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/stock/adjust',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Stock', id: 'BALANCES' },
        { type: 'Stock', id: 'SUMMARY' },
        { type: 'Stock', id: 'MOVEMENTS' },
      ],
    }),

    getPurchaseDecisions: builder.query<{ success: boolean; data: any[]; pagination?: any }, any>({
      query: (params) => ({
        url: '/purchase-decisions',
        params: params || {},
      }),
      providesTags: [{ type: 'Stock', id: 'PURCHASE_DECISIONS' }],
    }),

    createPurchaseDecision: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/purchase-decisions',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Stock', id: 'PURCHASE_DECISIONS' },
        { type: 'Material', id: 'LIST' },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    updatePurchaseDecision: builder.mutation<
      { success: boolean; data: any },
      {
        orderId?: string;
        decisionId: string;
        status?: 'ordered' | 'cancelled' | 'approved' | 'rejected';
        action?: 'approve' | 'reject';
        notes?: string;
        reason?: string;
        expectedArrivalDate?: string;
      }
    >({
      query: ({ orderId, decisionId, ...body }) => ({
        url: orderId
          ? `/orders/${orderId}/purchase-decisions/${decisionId}`
          : `/purchase-decisions/${decisionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [
        { type: 'Stock', id: 'PURCHASE_DECISIONS' },
        { type: 'Material', id: 'LIST' },
        { type: 'Order', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetStockBalancesQuery,
  useGetStockSummaryQuery,
  useGetStockMovementsQuery,
  useRecordGoodsReceiptMutation,
  useAdjustStockMutation,
  useGetPurchaseDecisionsQuery,
  useCreatePurchaseDecisionMutation,
  useUpdatePurchaseDecisionMutation,
} = stockApi;

