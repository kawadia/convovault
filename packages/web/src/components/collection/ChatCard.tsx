import { Link } from 'react-router';
import type { ChatSummary } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface ChatCardProps {
  chat: ChatSummary;
  onDelete?: (id: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onLoginRequired?: (title: string, message: string) => void;
  favoriteCount?: number;
}

export default function ChatCard({
  chat,
  onDelete,
  isBookmarked,
  onToggleBookmark,
  isFavorite,
  onToggleFavorite,
  onLoginRequired,
  favoriteCount = 0
}: ChatCardProps) {
  const { user, isAdmin } = useAuth();

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

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      onLoginRequired?.('Save to favorites', 'Sign in to keep track of your favorite dialogues.');
      return;
    }
    onToggleFavorite?.(chat.id);
  };

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleBookmark?.(chat.id);
  };

  // Format participants display
  const participantsDisplay = chat.participants
    ? `${chat.participants.user} & ${chat.participants.assistant}`
    : null;

  // User can delete if they are the owner or an admin
  const canDelete = user && (chat.userId === user.id || isAdmin);

  return (
    <div className="relative group">
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
        <div className="flex items-center gap-0.5 group/heart">
          <button
            onClick={handleToggleFavorite}
            className={`p-1.5 transition-all ${isFavorite
              ? 'text-hot-pink opacity-100'
              : 'text-text-secondary opacity-0 group-hover:opacity-100'
              } hover:scale-110 active:scale-95`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg
              className="w-5 h-5 transition-colors"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
          {favoriteCount > 0 && (
            <span className={`text-[11px] font-medium transition-all ${isFavorite
              ? 'text-hot-pink opacity-100'
              : 'text-text-secondary opacity-0 group-hover:opacity-100'
              } select-none -ml-1 pr-1`}>
              {favoriteCount}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              e.stopPropagation();
              onLoginRequired?.('Bookmark for later', 'Sign in to bookmark this conversation for your next reading session.');
            } else {
              handleToggleBookmark(e);
            }
          }}
          className={`p-1.5 transition-all ${isBookmarked
            ? 'text-accent opacity-100'
            : 'text-text-secondary opacity-0 group-hover:opacity-100'
            } hover:scale-110 active:scale-95`}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark chat'}
        >
          <svg
            className="w-5 h-5 transition-colors"
            fill={isBookmarked ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
        </button>

        {canDelete && onDelete && (
          <button
            onClick={handleDelete}
            className="p-1.5 bg-bg-tertiary text-text-secondary rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
            title="Delete chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
              />
            </svg>
          </button>
        )}
      </div>

      <Link
        to={`/chat/${chat.id}`}
        className="block bg-bg-secondary rounded-lg hover:bg-bg-tertiary transition-colors p-4 border border-border"
      >
        <h3 className="font-semibold text-text-primary truncate mb-2">
          {chat.title}
        </h3>

        {participantsDisplay && (
          <div className="text-sm text-text-secondary mb-2 flex items-center gap-1.5 leading-none">
            <svg className="w-4 h-4 -translate-y-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="translate-y-[0.5px]">{participantsDisplay}</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-text-secondary leading-none">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 -translate-y-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="translate-y-[0.5px]">{chat.messageCount} messages</span>
          </span>

          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 -translate-y-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="translate-y-[0.5px]">{chat.wordCount.toLocaleString()} words</span>
          </span>
        </div>

        <div className="mt-3 text-xs text-text-muted">
          Imported {formattedDate}
        </div>
      </Link>
    </div >
  );
}
