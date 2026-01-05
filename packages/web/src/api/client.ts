import type { Message, Participants } from '@convovault/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Get or create anonymous user ID
function getUserId(): string {
  const key = 'convovault-user-id';
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

// Get admin key if stored
function getAdminKey(): string | null {
  return localStorage.getItem('convovault-admin-key');
}

export function setAdminKey(key: string): void {
  localStorage.setItem('convovault-admin-key', key);
}

export function clearAdminKey(): void {
  localStorage.removeItem('convovault-admin-key');
}

export function isAdmin(): boolean {
  return !!getAdminKey();
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': getUserId(),
  };

  const adminKey = getAdminKey();
  if (adminKey) {
    headers['X-Admin-Key'] = adminKey;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
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
}

export interface ChatDetail extends ChatSummary {
  messages: Message[];
  participants?: Participants;
}

export const api = {
  // List all chats
  async listChats(): Promise<{ chats: ChatSummary[] }> {
    return fetchApi<{ chats: ChatSummary[] }>('/chats');
  },

  // Import a chat (admin only)
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

  // Delete a chat (admin only)
  async deleteChat(id: string): Promise<{ deleted: boolean }> {
    return fetchApi<{ deleted: boolean }>(`/chats/${id}`, {
      method: 'DELETE',
    });
  },
};
