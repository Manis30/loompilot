import { apiSlice } from './apiSlice';

export interface CopilotReply {
  answer: string;
  sources: string[];
  suggestedQuestions?: string[];
  highlightData?: {
    label: string;
    value: string;
  };
  actionButton?: {
    label: string;
    targetTab: string;
  };
}

export const copilotApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    askAdminAssistant: builder.mutation<{ success: boolean; data: CopilotReply }, { query: string }>(
      {
        query: ({ query }) => ({
          url: '/admin/assistant/ask',
          method: 'POST',
          body: { query },
        }),
      }
    ),
  }),
});

export const { useAskAdminAssistantMutation } = copilotApi;

