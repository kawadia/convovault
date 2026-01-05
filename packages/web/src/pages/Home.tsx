import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, SearchResult } from '../api/client';
import ImportModal from '../components/collection/ImportModal';
import ChatCard from '../components/collection/ChatCard';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function Home() {
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.listChats(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteChat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Search when debounced query changes
  useEffect(() => {
    const doSearch = async () => {
      if (debouncedQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const result = await api.search(debouncedQuery);
        setSearchResults(result.results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    doSearch();
  }, [debouncedQuery]);

  const chats = data?.chats || [];
  const isShowingSearch = searchQuery.length >= 2;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-secondary border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-text-primary">
              ConvoVault
            </h1>
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              Import Chat
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-bg-tertiary text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Search Results */}
        {isShowingSearch && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {isSearching ? (
                'Searching...'
              ) : searchResults.length > 0 ? (
                `${searchResults.length} result${searchResults.length === 1 ? '' : 's'} for "${searchQuery}"`
              ) : (
                `No results for "${searchQuery}"`
              )}
            </h2>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((result, idx) => (
                  <Link
                    key={`${result.chatId}-${result.messageIndex}-${idx}`}
                    to={`/chat/${result.chatId}#msg-${result.messageIndex}`}
                    className="block bg-bg-secondary rounded-lg hover:bg-bg-tertiary transition-colors p-4 border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          result.role === 'user'
                            ? 'bg-accent text-white'
                            : 'bg-text-muted text-white'
                        }`}
                      >
                        {result.role === 'user' ? 'U' : 'A'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary mb-1">
                          {result.chatTitle}
                        </div>
                        <div
                          className="text-sm text-text-secondary line-clamp-2"
                          dangerouslySetInnerHTML={{
                            __html: (result.snippet || '')
                              .replace(/\*\*/g, '<mark class="bg-accent/30 text-accent rounded px-0.5">')
                              .replace(/<mark[^>]*>([^<]*)<\/mark>/g, (_, text) =>
                                `<mark class="bg-accent/30 text-accent rounded px-0.5">${text}</mark>`
                              )
                              // Fix: properly close marks
                              .replace(/\*\*/g, '</mark>')
                          }}
                        />
                      </div>
                      <svg
                        className="w-5 h-5 text-text-muted flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat List (shown when not searching) */}
        {!isShowingSearch && (
          <>
            {isLoading ? (
              <div className="text-center text-text-secondary py-12">Loading...</div>
            ) : chats.length === 0 ? (
              <div className="text-center text-text-secondary py-12">
                <p>No chats imported yet.</p>
                <p className="mt-2">Click "Import Chat" to add your first conversation.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chats.map((chat) => (
                  <ChatCard key={chat.id} chat={chat} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
