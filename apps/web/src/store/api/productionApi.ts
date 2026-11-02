import { apiSlice } from './apiSlice';

export const productionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProductionBoard: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/production/board',
      providesTags: [{ type: 'Production', id: 'BOARD' }],
    }),

    getSupervisorReports: builder.query<{ success: boolean; data: any[]; pagination?: any }, any>({
      query: (params) => ({
        url: '/supervisor/reports',
        params: params || {},
      }),
      providesTags: [{ type: 'Supervisor', id: 'REPORTS' }],
    }),

    getAdminSupervisorReports: builder.query<{ success?: boolean; data: any[]; meta?: any; pagination?: any }, any>({
      query: (params) => ({
        url: '/supervisor-reports',
        params: params || {},
      }),
      providesTags: [{ type: 'Supervisor', id: 'REPORTS' }],
    }),

    submitSupervisorReport: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/supervisor/reports',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Supervisor', id: 'REPORTS' },
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    getMaintenanceTickets: builder.query<{ success: boolean; data: any[]; pagination?: any }, any>({
      query: (params) => ({
        url: '/maintenance-tickets',
        params: params || {},
      }),
      providesTags: [{ type: 'Production', id: 'TICKETS' }],
    }),

    createMaintenanceTicket: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/maintenance-tickets',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, body) => [
        { type: 'Production', id: 'TICKETS' },
        { type: 'Machine', id: 'LIST' },
        ...(body?.machineId ? [{ type: 'Machine' as const, id: body.machineId }] : []),
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    updateMaintenanceTicket: builder.mutation<
      { success: boolean; data: any },
      { id: string; status?: 'open' | 'assigned' | 'resolved'; technicianName?: string; technicianContact?: string; notes?: string; machineId?: string }
    >({
      query: ({ id, machineId: _machineId, ...body }) => ({
        url: `/maintenance-tickets/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id, machineId }) => [
        { type: 'Production', id: 'TICKETS' },
        { type: 'Machine', id: 'LIST' },
        ...(machineId ? [{ type: 'Machine' as const, id: machineId }] : []),
        { type: 'Production', id: 'BOARD' },
      ],
    }),

    getSupervisorNotifications: builder.query<{ success: boolean; data: any[]; pagination?: any }, any>({
      query: (params) => ({
        url: '/supervisor/notifications',
        params: params || {},
      }),
      providesTags: [{ type: 'Notification', id: 'SUPERVISOR' }],
    }),

    markNotificationRead: builder.mutation<{ success: boolean; data: any }, string>({
      query: (id) => ({
        url: `/supervisor/notifications/${id}/read`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Notification', id: 'SUPERVISOR' }],
    }),
  }),
});

export const {
  useGetProductionBoardQuery,
  useGetSupervisorReportsQuery,
  useGetAdminSupervisorReportsQuery,
  useSubmitSupervisorReportMutation,
  useGetMaintenanceTicketsQuery,
  useCreateMaintenanceTicketMutation,
  useUpdateMaintenanceTicketMutation,
  useGetSupervisorNotificationsQuery,
  useMarkNotificationReadMutation,
} = productionApi;

