import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, SearchResult } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ImportModal from '../components/collection/ImportModal';
import ChatCard from '../components/collection/ChatCard';
import DeleteConfirmModal from '../components/collection/DeleteConfirmModal';
import LoginPrompt from '../components/auth/LoginPrompt';
import MorphingHeader from '../components/layout/MorphingHeader';
import { SortOption } from '../components/layout/MorphingHeader/SortDropdown';

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
  const [chatToDelete, setChatToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user, login, isLoading: isAuthLoading } = useAuth();

  const [sortBy, setSortBy] = useState<SortOption>('newest');
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
    onMutate: async ({ id, bookmark }) => {
      await queryClient.cancelQueries({ queryKey: ['chats'] });
      const previousChats = queryClient.getQueryData<{ chats: any[] }>(['chats']);

      queryClient.setQueryData(['chats'], (old: any) => {
        if (!old?.chats) return old;
        return {
          ...old,
          chats: old.chats.map((c: any) =>
            c.id === id ? { ...c, isBookmarked: bookmark } : c
          )
        };
      });

      return { previousChats };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(['chats'], context.previousChats);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const toggleBookmark = (id: string, current: boolean) => {
    if (!user) return;
    bookmarkMutation.mutate({ id, bookmark: !current });
  };

  const favoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api.toggleFavorite(id, favorite),
    onMutate: async ({ id, favorite }) => {
      // Update chats list
      await queryClient.cancelQueries({ queryKey: ['chats'] });
      const previousChats = queryClient.getQueryData<{ chats: any[] }>(['chats']);
      queryClient.setQueryData(['chats'], (old: any) => {
        if (!old?.chats) return old;
        return {
          ...old,
          chats: old.chats.map((c: any) =>
            c.id === id ? { ...c, isFavorite: favorite } : c
          )
        };
      });

      // Update social counts
      await queryClient.cancelQueries({ queryKey: ['social-counts'] });
      const previousSocial = queryClient.getQueryData<{ counts: Record<string, number> }>(['social-counts']);
      queryClient.setQueryData(['social-counts'], (old: any) => {
        const counts = old?.counts || {};
        return {
          ...old,
          counts: {
            ...counts,
            [id]: (counts[id] || 0) + (favorite ? 1 : -1)
          }
        };
      });

      return { previousChats, previousSocial };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) queryClient.setQueryData(['chats'], context.previousChats);
      if (context?.previousSocial) queryClient.setQueryData(['social-counts'], context.previousSocial);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['social-counts'] });
    },
  });

  const toggleFavorite = (id: string, current: boolean) => {
    if (!user) return;
    favoriteMutation.mutate({ id, favorite: !current });
  };

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['chats', user?.id],
    queryFn: () => api.listChats(),
  });

  const { data: socialData } = useQuery({
    queryKey: ['social-counts'],
    queryFn: () => api.getSocialCounts(),
    refetchInterval: 30000, // Refresh every 30s
  });

  const socialCounts = socialData?.counts || {};

  // Force cache invalidation when user logs out to clear personal state
  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: ['chats'] });
    }
  }, [user, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteChat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      // Also invalidate exact user query to be safe
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
      }
      setChatToDelete(null);
      setDeleteError(null);
    },
    onError: (error) => {
      console.error('Failed to delete chat:', error);
      setDeleteError(error.message);
    },
  });

  const handleDeleteClick = (chat: { id: string; title: string }) => {
    setDeleteError(null);
    setChatToDelete(chat);
  };

  const handleDeleteConfirm = () => {
    if (chatToDelete) {
      deleteMutation.mutate(chatToDelete.id);
    }
  };

  const handleDeleteCancel = () => {
    setChatToDelete(null);
    setDeleteError(null);
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

  const handleImportClick = () => {
    if (user) {
      setShowImport(true);
    } else {
      setLoginPrompt({
        title: 'Import your dialogues',
        message: 'Sign in to import and preserve your Socratic conversations from Claude.'
      });
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <MorphingHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onClearFilters={() => setActiveFilters(new Set())}
        onImportClick={handleImportClick}
        user={user}
        isAuthLoading={isAuthLoading}
        onLogin={login}
      />

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
                    onDelete={handleDeleteClick}
                    isBookmarked={user ? !!chat.isBookmarked : false}
                    onToggleBookmark={(id) => toggleBookmark(id, !!chat.isBookmarked)}
                    isFavorite={user ? !!chat.isFavorite : false}
                    onToggleFavorite={(id) => toggleFavorite(id, !!chat.isFavorite)}
                    onLoginRequired={(title, message) => setLoginPrompt({ title, message })}
                    favoriteCount={socialCounts[chat.id] || 0}
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
      {chatToDelete && (
        <DeleteConfirmModal
          title={chatToDelete.title}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={deleteMutation.isPending}
          error={deleteError}
        />
      )}
    </div>
  );
}
