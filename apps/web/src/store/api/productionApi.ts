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
      invalidatesTags: [
        { type: 'Production', id: 'TICKETS' },
        { type: 'Machine', id: 'LIST' },
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
  useSubmitSupervisorReportMutation,
  useGetMaintenanceTicketsQuery,
  useCreateMaintenanceTicketMutation,
  useGetSupervisorNotificationsQuery,
  useMarkNotificationReadMutation,
} = productionApi;

