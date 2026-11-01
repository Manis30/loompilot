import { apiSlice } from './apiSlice';

export interface OrderQuery {
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export const ordersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, OrderQuery | void>({
      query: (params) => ({
        url: '/orders',
        params: params || {},
      }),
      transformResponse: (response: any) => {
        if (Array.isArray(response)) {
          return { success: true, data: response, pagination: undefined, meta: undefined };
        }
        return {
          success: true,
          data: response?.data || response?.items || [],
          pagination: response?.meta || response?.pagination,
          meta: response?.meta || response?.pagination,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id, _id }: any) => ({ type: 'Order' as const, id: id || _id })),
              { type: 'Order', id: 'LIST' },
            ]
          : [{ type: 'Order', id: 'LIST' }],
    }),

    getOrderById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Order', id }],
    }),

    getOrderSummary: builder.query<{ success: boolean; data: any }, { from?: string; to?: string } | void>({
      query: (params) => ({
        url: '/orders/summary',
        params: params || {},
      }),
      providesTags: [{ type: 'Order', id: 'SUMMARY' }],
    }),

    createOrder: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/orders',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Order', id: 'LIST' }, { type: 'Order', id: 'SUMMARY' }],
    }),

    updateOrder: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    decideOrder: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/decide`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    approveQuotation: builder.mutation<
      { success: boolean; data: any },
      { id: string; body?: any; idempotencyKey?: string }
    >({
      query: ({ id, body, idempotencyKey }) => {
        const idempKey =
          idempotencyKey ||
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `idem-quote-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
        return {
          url: `/orders/${id}/quotation/approve`,
          method: 'POST',
          body: body || { action: 'approve' },
          headers: {
            'Idempotency-Key': idempKey,
          },
        };
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        { type: 'Order', id: 'SUMMARY' },
      ],
    }),

    advanceOrderStage: builder.mutation<
      { success: boolean; data: any },
      { id: string; stage: string; producedQty?: number; percentComplete?: number; notes?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/orders/${id}/stage`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        { type: 'Order', id: 'SUPERVISOR' },
        { type: 'Order', id: 'SUMMARY' },
      ],
    }),

    sendQuotation: builder.mutation<{ success: boolean; data: any }, string>({
      query: (id) => ({
        url: `/orders/${id}/quotation/send`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    assignSupervisors: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/assign`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    startProduction: builder.mutation<{ success: boolean; data: any }, string>({
      query: (id) => ({
        url: `/orders/${id}/start`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Order', id },
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    holdOrder: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/hold`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    resumeOrder: builder.mutation<{ success: boolean; data: any }, string>({
      query: (id) => ({
        url: `/orders/${id}/resume`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Order', id },
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    cancelOrder: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/cancel`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    createPaymentOrder: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/payments/create-order`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Order', id }],
    }),

    recordManualReceipt: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/payments/manual-receipt`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    recordDelivery: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/orders/${id}/deliveries`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    // Client Portal endpoints
    getClientOrders: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, OrderQuery | void>({
      query: (params) => ({
        url: '/client/orders',
        params: params || {},
      }),
      transformResponse: (response: any) => {
        if (Array.isArray(response)) {
          return { success: true, data: response, pagination: undefined, meta: undefined };
        }
        return {
          success: true,
          data: response?.data || response?.items || [],
          pagination: response?.meta || response?.pagination,
          meta: response?.meta || response?.pagination,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id, _id }: any) => ({ type: 'Order' as const, id: id || _id })),
              { type: 'Order', id: 'CLIENT_LIST' },
            ]
          : [{ type: 'Order', id: 'CLIENT_LIST' }],
    }),

    // Mill Supervisor endpoints
    getSupervisorOrders: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, OrderQuery | void>({
      query: (params) => ({
        url: '/supervisor/orders',
        params: params || {},
      }),
      transformResponse: (response: any) => {
        if (Array.isArray(response)) {
          return { success: true, data: response, pagination: undefined, meta: undefined };
        }
        return {
          success: true,
          data: response?.data || response?.items || [],
          pagination: response?.meta || response?.pagination,
          meta: response?.meta || response?.pagination,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id, _id }: any) => ({ type: 'Order' as const, id: id || _id })),
              { type: 'Order', id: 'SUPERVISOR_LIST' },
            ]
          : [{ type: 'Order', id: 'SUPERVISOR_LIST' }],
    }),

    getClientOrderById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/client/orders/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Order', id }],
    }),

    submitClientOrder: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/client/orders',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Order', id: 'CLIENT_LIST' }, { type: 'Order', id: 'LIST' }],
    }),

    clientAcceptQuotation: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/client/orders/${id}/quotation/accept`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'CLIENT_LIST' },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    clientDeclineQuotation: builder.mutation<{ success: boolean; data: any }, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/client/orders/${id}/quotation/decline`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'CLIENT_LIST' },
        { type: 'Order', id: 'LIST' },
      ],
    }),

    clientPayMilestone: builder.mutation<
      { success: boolean; data: any },
      { id: string; milestoneId: string }
    >({
      query: ({ id, milestoneId }) => ({
        url: `/client/orders/${id}/milestones/${milestoneId}/pay`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Order', id }],
    }),

    clientCreatePaymentOrder: builder.mutation<
      { success: boolean; data: any },
      { id: string; milestoneIndex: number; body?: any; idempotencyKey?: string }
    >({
      query: ({ id, milestoneIndex, body, idempotencyKey }) => {
        const idempKey =
          idempotencyKey ||
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `idem-cl-pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
        return {
          url: `/client/orders/${id}/payments/${milestoneIndex}/razorpay-order`,
          method: 'POST',
          body: body || {},
          headers: {
            'Idempotency-Key': idempKey,
          },
        };
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'CLIENT_LIST' },
      ],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderSummaryQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDecideOrderMutation,
  useApproveQuotationMutation,
  useAdvanceOrderStageMutation,
  useSendQuotationMutation,
  useAssignSupervisorsMutation,
  useStartProductionMutation,
  useHoldOrderMutation,
  useResumeOrderMutation,
  useCancelOrderMutation,
  useCreatePaymentOrderMutation,
  useRecordManualReceiptMutation,
  useRecordDeliveryMutation,
  useGetClientOrdersQuery,
  useGetClientOrderByIdQuery,
  useGetSupervisorOrdersQuery,
  useSubmitClientOrderMutation,
  useClientAcceptQuotationMutation,
  useClientDeclineQuotationMutation,
  useClientPayMilestoneMutation,
  useClientCreatePaymentOrderMutation,
} = ordersApi;

