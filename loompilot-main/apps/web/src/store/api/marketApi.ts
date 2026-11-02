import { apiSlice } from './apiSlice';
import type { MarketCommodity } from '../../types';

export interface SurgeAlertItem {
  id: string;
  orderNumber: string;
  clientName: string;
  productName: string;
  quantity: number;
  status: string;
  lockedMaterialsCount: number;
  hasLockedMaterials: boolean;
  originalUnitPricePaise: number;
  revisedUnitPricePaise: number;
  originalTotalPaise: number;
  revisedTotalPaise: number;
  variancePaise: number;
}

export const marketApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMarketPrices: builder.query<{ success: boolean; data: MarketCommodity[] }, void>({
      query: () => '/market-prices',
      providesTags: [{ type: 'AI' as const, id: 'market_prices' }],
    }),

    getSurgeAlerts: builder.query<
      { success: boolean; data: { alerts: MarketCommodity[]; affectedOrders: SurgeAlertItem[] } },
      void
    >({
      query: () => '/market-prices/alerts',
      providesTags: [{ type: 'AI' as const, id: 'market_alerts' }],
    }),

    triggerRequote: builder.mutation<
      { success: boolean; data: any },
      { orderId: string; notes?: string; surgeRatePaise?: number }
    >({
      query: (body) => ({
        url: '/market-prices/trigger-requote',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Order' as const },
        { type: 'Quotation' as const },
        { type: 'AI' as const, id: 'market_alerts' },
      ],
    }),
  }),
});

export const {
  useGetMarketPricesQuery,
  useGetSurgeAlertsQuery,
  useTriggerRequoteMutation,
} = marketApi;

