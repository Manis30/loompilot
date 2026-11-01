import { apiSlice } from './apiSlice';

export const catalogApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, any | void>({
      query: (params) => ({
        url: '/products',
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
              ...result.data.map(({ id, _id }: any) => ({ type: 'Product' as const, id: id || _id })),
              { type: 'Product', id: 'LIST' },
            ]
          : [{ type: 'Product', id: 'LIST' }],
    }),

    getProductById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/products/${id}`,
      transformResponse: (response: any) => ({
        success: true,
        data: response?.data || response,
      }),
      providesTags: (_res, _err, id) => [{ type: 'Product', id }],
    }),

    getClientProducts: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, any | void>({
      query: (params) => ({
        url: '/client/products',
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
      providesTags: [{ type: 'Product', id: 'CLIENT_LIST' }],
    }),

    getClientProductById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/client/products/${id}`,
      transformResponse: (response: any) => ({
        success: true,
        data: response?.data || response,
      }),
      providesTags: (_res, _err, id) => [{ type: 'Product', id }],
    }),

    getMaterials: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, void | Record<string, any>>({
      query: (params) => ({
        url: '/materials',
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
      providesTags: [{ type: 'Material', id: 'LIST' }],
    }),

    getMaterialById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/materials/${id}`,
      transformResponse: (response: any) => ({
        success: true,
        data: response?.data || response,
      }),
      providesTags: (_res, _err, id) => [{ type: 'Material', id }],
    }),

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

    getSuppliers: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, any | void>({
      query: (params) => ({
        url: '/suppliers',
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
      providesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),

    getClients: builder.query<{ success: boolean; data: any[]; pagination?: any; meta?: any }, any | void>({
      query: (params) => ({
        url: '/clients',
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
      providesTags: [{ type: 'Client', id: 'LIST' }],
    }),

    getClientById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/clients/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Client', id }],
    }),

    getUsers: builder.query<{ success: boolean; data: any[]; pagination?: any }, any>({
      query: (params) => ({
        url: '/users',
        params: params || {},
      }),
      providesTags: [{ type: 'User', id: 'LIST' }],
    }),

    getUserById: builder.query<{ success: boolean; data: any }, string>({
      query: (id) => `/users/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'User', id }],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useGetClientProductsQuery,
  useGetClientProductByIdQuery,
  useGetMaterialsQuery,
  useGetMaterialByIdQuery,
  useGetMachinesQuery,
  useGetMachineByIdQuery,
  useCreateMachineMutation,
  useUpdateMachineStatusMutation,
  useGetSuppliersQuery,
  useGetClientsQuery,
  useGetClientByIdQuery,
  useGetUsersQuery,
  useGetUserByIdQuery,
} = catalogApi;

