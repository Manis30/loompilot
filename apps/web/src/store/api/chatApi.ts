import { apiSlice } from './apiSlice';

export interface ChatMessageItem {
  id?: string;
  senderType: 'client' | 'assistant' | 'admin';
  text: string;
  createdAt: string;
  visibility?: 'client_visible' | 'admin_note';
}

export interface ConversationItem {
  _id: string;
  id?: string;
  orderId: string;
  clientId: string;
  status: 'agent_handling' | 'escalated' | 'admin_handling' | 'resolved';
  lastMessageAt?: string;
  messages: ChatMessageItem[];
  escalation?: {
    type: 'discount' | 'extra_demand' | 'unsure' | 'complaint';
    summary: string;
    status: 'open' | 'in_progress' | 'resolved';
    currentPricePaise?: number;
    resolution?: {
      by: string;
      at: string;
      outcome: string;
      notes?: string;
    };
  };
}

export const chatApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClientOrderChat: builder.query<{ success: boolean; data: ConversationItem }, string>({
      query: (orderId) => `/client/orders/${orderId}/chat`,
      providesTags: (_res, _err, orderId) => [{ type: 'AI' as const, id: `chat_${orderId}` }],
    }),

    sendClientOrderMessage: builder.mutation<
      { success: boolean; data: { reply: string; conversation: ConversationItem } },
      { orderId: string; message: string }
    >({
      query: ({ orderId, message }) => ({
        url: `/client/orders/${orderId}/chat`,
        method: 'POST',
        body: { message },
      }),
      invalidatesTags: (_res, _err, { orderId }) => [
        { type: 'AI' as const, id: `chat_${orderId}` },
        { type: 'Notification' as const },
      ],
    }),

    getAdminConversations: builder.query<
      { success: boolean; data: ConversationItem[] },
      { status?: string; hasEscalation?: boolean } | void
    >({
      query: (params) => ({
        url: '/conversations',
        params: params || undefined,
      }),
      providesTags: [{ type: 'AI' as const, id: 'admin_conversations' }],
    }),

    sendAdminMessage: builder.mutation<
      { success: boolean; data: ConversationItem },
      { conversationId: string; message: string; orderId?: string }
    >({
      query: ({ conversationId, message }) => ({
        url: `/conversations/${conversationId}/messages`,
        method: 'POST',
        body: { message },
      }),
      invalidatesTags: (_res, _err, { conversationId, orderId }) => [
        { type: 'AI' as const, id: 'admin_conversations' },
        ...(orderId ? [{ type: 'AI' as const, id: `chat_${orderId}` }] : []),
      ],
    }),

    resolveAdminEscalation: builder.mutation<
      { success: boolean; data: ConversationItem },
      { conversationId: string; approved: boolean; concessionPercent?: number; notes?: string; orderId?: string }
    >({
      query: ({ conversationId, approved, concessionPercent, notes }) => ({
        url: `/conversations/${conversationId}/escalations/resolve`,
        method: 'POST',
        body: { approved, concessionPercent, notes },
      }),
      invalidatesTags: (_res, _err, { orderId }) => [
        { type: 'AI' as const, id: 'admin_conversations' },
        { type: 'Order' as const },
        ...(orderId ? [{ type: 'AI' as const, id: `chat_${orderId}` }] : []),
      ],
    }),
  }),
});

export const {
  useGetClientOrderChatQuery,
  useSendClientOrderMessageMutation,
  useGetAdminConversationsQuery,
  useSendAdminMessageMutation,
  useResolveAdminEscalationMutation,
} = chatApi;

