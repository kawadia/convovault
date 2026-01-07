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
      <div className="min-h-screen bg-[#2f2f2f] flex items-center justify-center">
        <div className="text-[#888]">Loading...</div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="min-h-screen bg-[#2f2f2f] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">Chat not found</div>
        <Link to="/" className="text-accent hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2f2f2f]">
      {/* Minimal sticky header */}
      <header className="sticky top-0 z-20 bg-[#2f2f2f]/95 backdrop-blur-sm border-b border-[#3a3a3a]">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-lg text-[#888] hover:text-[#e8e6e3] hover:bg-[#2a2a2a] transition-colors"
            title="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-medium text-[#e8e6e3] truncate">
              {chat.title}
            </h1>
          </div>

          {/* Search toggle */}
          <button
            onClick={() => setShowSearch(prev => !prev)}
            className={`p-2 rounded-lg transition-colors ${
              showSearch
                ? 'bg-accent text-white'
                : 'text-[#888] hover:text-[#e8e6e3] hover:bg-[#2a2a2a]'
            }`}
            title="Search (⌘F)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* External link */}
          <a
            href={chat.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-[#888] hover:text-[#e8e6e3] hover:bg-[#2a2a2a] transition-colors"
            title="View on Claude"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="border-t border-[#333] px-6 py-3">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]"
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
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[#2a2a2a] border border-[#333] text-[#e8e6e3] placeholder:text-[#666] focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                  autoFocus
                />
              </div>

              {/* Match count and navigation */}
              {searchQuery.length >= 2 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#888] whitespace-nowrap">
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
                        className="p-1.5 rounded hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed text-[#888]"
                        title="Previous (Shift+Enter)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={goToNextMatch}
                        disabled={currentMatchIndex === searchResults.length - 1}
                        className="p-1.5 rounded hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed text-[#888]"
                        title="Next (Enter)"
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
                className="p-1.5 rounded hover:bg-[#333] text-[#666]"
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

      {/* Disclaimer banner like Claude */}
      <div className="bg-[#2a2a2a] border-b border-[#333]">
        <div className="max-w-3xl mx-auto px-6 py-3">
          <div className="flex items-start gap-3 text-sm text-[#888]">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="leading-relaxed">
              This is a copy of a chat{chat.participants ? ` between ${chat.participants.assistant} and ${chat.participants.user}` : ''}.
              {' '}Content may include unverified or unsafe content that do not represent the views of Anthropic.
            </p>
          </div>
        </div>
      </div>

      {/* Chat content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <ChatViewer
          messages={chat.messages}
          highlightedMessageIndex={highlightedMessageIndex}
        />
      </main>
    </div>
  );
}
