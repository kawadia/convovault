import type { Message, Participants } from '@convovault/shared';

// Use api.diastack.com in production, allow override via env var for local dev
const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://api.diastack.com/api/v1' : '/api/v1');

// Get or create anonymous user ID (for non-logged-in users)
function getUserId(): string {
  const key = 'diastack-user-id';
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': getUserId(),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Include cookies for session auth
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface ChatSummary {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  messageCount: number;
  wordCount: number;
  fetchedAt: number;
  cached?: boolean;
  participants?: Participants;
  userId?: string; // Owner of the chat (who imported it)
}

export interface ChatDetail extends ChatSummary {
  messages: Message[];
}

export interface SearchResult {
  chatId: string;
  chatTitle: string;
  messageIndex: number;
  role: 'user' | 'assistant';
  snippet: string;
}

export const api = {
  // List all chats
  async listChats(): Promise<{ chats: ChatSummary[] }> {
    return fetchApi<{ chats: ChatSummary[] }>('/chats');
  },

  // Import a chat (requires login)
  async importChat(url: string, html?: string): Promise<ChatSummary> {
    return fetchApi<ChatSummary>('/chats/import', {
      method: 'POST',
      body: JSON.stringify({ url, html }),
    });
  },

  // Get a chat by ID
  async getChat(id: string): Promise<ChatDetail> {
    return fetchApi<ChatDetail>(`/chats/${id}`);
  },

  // Delete a chat (owner or admin)
  async deleteChat(id: string): Promise<{ deleted: boolean }> {
    return fetchApi<{ deleted: boolean }>(`/chats/${id}`, {
      method: 'DELETE',
    });
  },

  // Search messages across all chats or within a specific chat
  async search(query: string, chatId?: string): Promise<{ results: SearchResult[] }> {
    const params = new URLSearchParams({ q: query });
    if (chatId) params.append('chatId', chatId);
    return fetchApi<{ results: SearchResult[] }>(`/search?${params.toString()}`);
  },
};
