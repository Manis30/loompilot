import { apiSlice } from './apiSlice';

export interface BusinessSettings {
  timezone?: string;
  minMarginPct?: number;
  defaultMarginPct?: number;
  advancePct?: number;
  safetyDays?: number;
  quoteValidityDays?: number;
  priceThresholds?: {
    daily?: number;
    sevenday?: number;
    vol?: number;
  };
  quoteReminderDays?: number[];
  paymentReminderLeadDays?: number;
  version?: number;
  [key: string]: any;
}

export const settingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<{ success: boolean; data: BusinessSettings }, void>({
      query: () => '/settings',
      providesTags: [{ type: 'Settings' as any, id: 'TENANT' }],
    }),
    updateSettings: builder.mutation<
      { success: boolean; data: BusinessSettings },
      Partial<BusinessSettings>
    >({
      query: (body) => ({
        url: '/settings',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'Settings' as any, id: 'TENANT' }],
    }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation } = settingsApi;

