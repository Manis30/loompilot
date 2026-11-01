import { apiSlice } from './apiSlice';

export const machinesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMachines: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, void | Record<string, any>>({
      query: (params) => ({
        url: '/machines',
        params: params || {},
      }),
      transformResponse: (response: any) => {
        if (Array.isArray(response)) {
          return { success: true, data: response };
        }
        return {
          success: true,
          data: response?.data || [],
          pagination: response?.meta || response?.pagination,
          meta: response?.meta || response?.pagination,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id, _id }: any) => ({ type: 'Machine' as const, id: id || _id })),
              { type: 'Machine', id: 'LIST' },
            ]
          : [{ type: 'Machine', id: 'LIST' }],
    }),

    getMachineById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/machines/${id}`,
      transformResponse: (response: any) => ({
        success: true,
        data: response?.data || response,
      }),
      providesTags: (_res, _err, id) => [{ type: 'Machine', id }],
    }),

    createMachine: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/machines',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Machine', id: 'LIST' }],
    }),

    updateMachineStatus: builder.mutation<
      { success: boolean; data: any },
      { id: string; status?: string; currentStatus?: string; notes?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/machines/${id}/status`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Machine', id },
        { type: 'Machine', id: 'LIST' },
        { type: 'Production', id: 'BOARD' },
      ],
    }),
  }),
});

export const {
  useGetMachinesQuery,
  useGetMachineByIdQuery,
  useCreateMachineMutation,
  useUpdateMachineStatusMutation,
} = machinesApi;

