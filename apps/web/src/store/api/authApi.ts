import { apiSlice } from './apiSlice';

export interface LoginRequest {
  email: string;
  password?: string;
  code?: string;
  tenantId?: string;
}

export interface AuthResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    avatarUrl?: string;
    processAreas?: string[];
  };
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
  clientAccount?: {
    id: string;
    email: string;
    name: string;
    clientId: string;
    tenantId?: string;
  };
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    loginStaff: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (response: any, _meta, arg): AuthResponse => ({
        success: true,
        accessToken: response.accessToken,
        expiresIn: response.expiresIn,
        user: {
          id: response.user?.id || '',
          email: response.user?.email || arg.email,
          name: response.user?.name || 'Staff Member',
          role: response.user?.role || 'staff',
          tenantId: response.user?.tenantId || arg.tenantId || 'tenant_loompilot_tn_01',
          processAreas: response.user?.processAreas,
        },
      }),
      invalidatesTags: ['Auth'],
    }),
    loginClient: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/client/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (response: any, _meta, arg): AuthResponse => ({
        success: true,
        accessToken: response.accessToken,
        expiresIn: response.expiresIn,
        clientAccount: response.clientAccount,
        user: {
          id: response.clientAccount?.id || response.clientAccount?.clientId || '',
          email: response.clientAccount?.email || arg.email,
          name: response.clientAccount?.name || 'Client Contact',
          role: 'client',
          tenantId: response.clientAccount?.tenantId || arg.tenantId || 'tenant_loompilot_tn_01',
        },
      }),
      invalidatesTags: ['Auth'],
    }),
    logoutStaff: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
    logoutClient: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/client/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
    getMe: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/me',
      providesTags: ['Auth'],
    }),
  }),
});

export const {
  useLoginStaffMutation,
  useLoginClientMutation,
  useLogoutStaffMutation,
  useLogoutClientMutation,
  useGetMeQuery,
} = authApi;
