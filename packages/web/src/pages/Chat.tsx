import { useParams, Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api, SearchResult } from '../api/client';
import ChatViewer from '../components/chat/ChatViewer';
import ChatHeader from '../components/chat/ChatHeader';
import { useTopVisibleMessage } from '../hooks/useTopVisibleMessage';

// Threshold for considering a message "long" - must match Message.tsx
const LONG_MESSAGE_THRESHOLD = 500;

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

  // Fold state (lifted from ChatViewer)
  const [globalFoldState, setGlobalFoldState] = useState<'all-folded' | 'all-unfolded' | null>(null);

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

  // Count long messages for fold controls
  const longMessageCount = useMemo(() => {
    if (!chat) return 0;
    return chat.messages.filter(m =>
      m.content.reduce((sum, block) => sum + block.content.length, 0) > LONG_MESSAGE_THRESHOLD
    ).length;
  }, [chat]);

  // Fold handlers
  const handleCollapseAll = useCallback(() => {
    setGlobalFoldState(null);
    setTimeout(() => setGlobalFoldState('all-folded'), 0);
  }, []);

  const handleExpandAll = useCallback(() => {
    setGlobalFoldState(null);
    setTimeout(() => setGlobalFoldState('all-unfolded'), 0);
  }, []);

  // Track which speaker's message is at top of viewport
  const currentSpeaker = useTopVisibleMessage();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">Chat not found</div>
        <Link to="/" className="text-accent hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  // Search bar component
  const searchBar = (
    <div className="border-t border-border px-6 py-3 bg-bg-primary/95 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
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
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-bg-hover border border-border text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-accent focus:border-accent outline-none"
            autoFocus
          />
        </div>

        {/* Match count and navigation */}
        {searchQuery.length >= 2 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted whitespace-nowrap">
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
                  className="p-1.5 rounded hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed text-text-muted"
                  title="Previous (Shift+Enter)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMatch}
                  disabled={currentMatchIndex === searchResults.length - 1}
                  className="p-1.5 rounded hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed text-text-muted"
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
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted"
          title="Close (Escape)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <ChatHeader
        chat={chat}
        longMessageCount={longMessageCount}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(prev => !prev)}
        searchBar={searchBar}
        currentSpeaker={currentSpeaker}
      />

      {/* Disclaimer banner */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <div className="bg-bg-secondary border border-border rounded-lg px-4 py-3">
          <div className="flex items-start gap-3 text-sm text-text-muted">
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
          globalFoldState={globalFoldState}
        />
      </main>
    </div>
  );
}
