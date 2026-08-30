import apiClient from './api';
import { ChatMessage, ChatProduct, ChatResponse } from '../types';

export const chatService = {
  send: async (
    message: string,
    history: ChatMessage[] = []
  ): Promise<{ reply: string; products: ChatProduct[] }> => {
    const response = await apiClient.post<ChatResponse>(
      '/chat',
      { message, history },
      { timeout: 60000 }
    );

    const body = response.data;
    if (!body?.success || !body.data) {
      throw new Error(body?.error || 'Chat request failed');
    }

    return {
      reply: body.data.reply,
      products: body.data.products || [],
    };
  },
};
