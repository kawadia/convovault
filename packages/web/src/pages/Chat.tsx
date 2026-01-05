import { useParams, Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { api, SearchResult } from '../api/client';
import ChatViewer from '../components/chat/ChatViewer';

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

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Extract message index from hash (e.g., #msg-5 -> 5)
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.startsWith('#msg-')) {
      const msgIndex = parseInt(hash.replace('#msg-', ''), 10);
      if (!isNaN(msgIndex)) {
        setHighlightedMessageIndex(msgIndex);
        // Clear highlight after 3 seconds
        const timer = setTimeout(() => {
          setHighlightedMessageIndex(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [location.hash]);

  // Search within this chat when query changes
  useEffect(() => {
    const doSearch = async () => {
      if (!id || debouncedQuery.length < 2) {
        setSearchResults([]);
        setCurrentMatchIndex(0);
        return;
      }

      setIsSearching(true);
      try {
        const result = await api.search(debouncedQuery, id);
        setSearchResults(result.results);
        setCurrentMatchIndex(0);
        // Highlight first result if any
        if (result.results.length > 0) {
          setHighlightedMessageIndex(result.results[0].messageIndex);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    doSearch();
  }, [debouncedQuery, id]);

  // Navigate to previous/next match
  const goToMatch = useCallback((index: number) => {
    if (searchResults.length === 0) return;
    const newIndex = Math.max(0, Math.min(index, searchResults.length - 1));
    setCurrentMatchIndex(newIndex);
    setHighlightedMessageIndex(searchResults[newIndex].messageIndex);
  }, [searchResults]);

  const goToPrevMatch = useCallback(() => {
    goToMatch(currentMatchIndex - 1);
  }, [currentMatchIndex, goToMatch]);

  const goToNextMatch = useCallback(() => {
    goToMatch(currentMatchIndex + 1);
  }, [currentMatchIndex, goToMatch]);

  // Keyboard shortcuts for search navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+F to toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      // Enter to go to next match, Shift+Enter for previous
      if (showSearch && e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevMatch();
        } else {
          goToNextMatch();
        }
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        setHighlightedMessageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, searchResults.length, goToPrevMatch, goToNextMatch]);

  const { data: chat, isLoading, error } = useQuery({
    queryKey: ['chat', id],
    queryFn: () => api.getChat(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-red-500">Chat not found</div>
        <Link to="/" className="text-indigo-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {chat.title}
            </h1>
            <a
              href={chat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on Claude
            </a>
            <p className="text-sm text-gray-500">
              {chat.messageCount} messages &middot; {chat.wordCount.toLocaleString()} words
            </p>
          </div>
          {/* Search button */}
          <button
            onClick={() => setShowSearch(prev => !prev)}
            className={`p-2 rounded-lg transition-colors ${
              showSearch
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Search in chat (Cmd/Ctrl+F)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in this chat..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              {/* Match count and navigation */}
              {searchQuery.length >= 2 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {isSearching ? (
                      'Searching...'
                    ) : searchResults.length === 0 ? (
                      'No matches'
                    ) : (
                      `${currentMatchIndex + 1} of ${searchResults.length}`
                    )}
                  </span>
                  {searchResults.length > 0 && (
                    <>
                      <button
                        onClick={goToPrevMatch}
                        disabled={currentMatchIndex === 0}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Previous match (Shift+Enter)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={goToNextMatch}
                        disabled={currentMatchIndex === searchResults.length - 1}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Next match (Enter)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {/* Close button */}
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setHighlightedMessageIndex(null);
                }}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                title="Close (Escape)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <ChatViewer
          messages={chat.messages}
          participants={chat.participants}
          highlightedMessageIndex={highlightedMessageIndex}
        />
      </main>
    </div>
  );
}
