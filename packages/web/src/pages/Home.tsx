import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, SearchResult } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ImportModal from '../components/collection/ImportModal';
import ChatCard from '../components/collection/ChatCard';
import UserMenu from '../components/layout/UserMenu';
import LoginPrompt from '../components/auth/LoginPrompt';

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
  const [loginPrompt, setLoginPrompt] = useState<{ title: string; message: string } | null>(null);
  const queryClient = useQueryClient();
  const { user, login, isLoading: isAuthLoading } = useAuth();

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (filter: string) => {
    const next = new Set(activeFilters);
    if (next.has(filter)) next.delete(filter);
    else next.add(filter);
    setActiveFilters(next);
  };

  const bookmarkMutation = useMutation({
    mutationFn: ({ id, bookmark }: { id: string; bookmark: boolean }) =>
      api.toggleBookmark(id, bookmark),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const toggleBookmark = (id: string, current: boolean) => {
    if (!user) return;
    bookmarkMutation.mutate({ id, bookmark: !current });
  };

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

  const rawChats = data?.chats || [];

  // Apply filters and sorting
  const chats = rawChats
    .filter(chat => {
      if (activeFilters.has('Favorites') && !chat.isFavorite) return false;
      if (activeFilters.has('Bookmarked') && !chat.isBookmarked) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return b.fetchedAt - a.fetchedAt;
        case 'oldest': return a.fetchedAt - b.fetchedAt;
        case 'longest': return b.messageCount - a.messageCount;
        case 'shortest': return a.messageCount - b.messageCount;
        default: return 0;
      }
    });

  const isShowingSearch = searchQuery.length >= 2;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-secondary border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                DiaStack
              </h1>
              <p className="text-sm text-text-secondary">
                Stack of Socratic Dialogues with LLMs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (user) {
                    setShowImport(true);
                  } else {
                    setLoginPrompt({
                      title: 'Import your dialogues',
                      message: 'Sign in to import and preserve your Socratic conversations from Claude.'
                    });
                  }
                }}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium border border-transparent"
                disabled={isAuthLoading}
              >
                Import Chat
              </button>
              {isAuthLoading ? (
                <div className="w-8 h-8 rounded-full bg-bg-tertiary animate-pulse border border-border" />
              ) : user ? (
                <UserMenu />
              ) : (
                <button
                  onClick={login}
                  className="px-4 py-2 bg-bg-secondary text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors flex items-center gap-2 font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 items-center flex-1 w-full">
              {/* Search bar - 50% width */}
              <div className="relative w-full md:w-[50%]">
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
                  className="w-full pl-10 pr-10 py-2.5 border border-border rounded-xl bg-bg-tertiary text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
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

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2 items-center">
                {['Favorites', 'Bookmarked'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => toggleFilter(filter)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${activeFilters.has(filter)
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:bg-bg-hover'
                      }`}
                  >
                    {filter}
                  </button>
                ))}
                {activeFilters.size > 0 && (
                  <button
                    onClick={() => setActiveFilters(new Set())}
                    className="text-xs text-text-muted hover:text-accent transition-colors underline underline-offset-4 ml-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm text-text-secondary whitespace-nowrap">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-bg-tertiary text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none cursor-pointer hover:bg-bg-hover transition-colors"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="longest">Most Messages</option>
                <option value="shortest">Fewest Messages</option>
              </select>
            </div>
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
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${result.role === 'user'
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
                  <ChatCard
                    key={chat.id}
                    chat={chat}
                    onDelete={handleDelete}
                    isBookmarked={chat.isBookmarked}
                    onToggleBookmark={(id) => toggleBookmark(id, !!chat.isBookmarked)}
                    onLoginRequired={(title, message) => setLoginPrompt({ title, message })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {loginPrompt && (
        <LoginPrompt
          title={loginPrompt.title}
          message={loginPrompt.message}
          onClose={() => setLoginPrompt(null)}
        />
      )}
    </div>
  );
}
