import { useParams, Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ChatViewer from '../components/chat/ChatViewer';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null);

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
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
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
        </div>
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
