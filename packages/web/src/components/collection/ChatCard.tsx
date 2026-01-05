import { Link } from 'react-router';
import type { ChatSummary } from '../../api/client';
import { isAdmin } from '../../api/client';

interface ChatCardProps {
  chat: ChatSummary;
  onDelete?: (id: string) => void;
}

export default function ChatCard({ chat, onDelete }: ChatCardProps) {
  const formattedDate = new Date(chat.fetchedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && confirm(`Delete "${chat.title}"?`)) {
      onDelete(chat.id);
    }
  };

  return (
    <div className="relative group">
      {isAdmin() && onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 z-10 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title="Delete chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <Link
        to={`/chat/${chat.id}`}
        className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-200 dark:border-gray-700"
      >
      <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-2">
        {chat.title}
      </h3>

      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          {chat.messageCount} messages
        </span>

        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {chat.wordCount.toLocaleString()} words
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formattedDate}
        </span>
        <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
          {chat.source}
        </span>
      </div>
      </Link>
    </div>
  );
}
