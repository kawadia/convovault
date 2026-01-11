import { Link } from 'react-router';
import { motion } from 'framer-motion';

interface CollapsedChatHeaderProps {
  onSearchClick: () => void;
  onMenuClick: () => void;
  showSearch: boolean;
}

export default function CollapsedChatHeader({
  onSearchClick,
  onMenuClick,
  showSearch,
}: CollapsedChatHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="header-glass border-b border-border/50"
    >
      <div className="max-w-3xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Back button */}
          <Link
            to="/"
            className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            title="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          {/* Claude button (tappable to open dropdown) */}
          <button
            onClick={onMenuClick}
            className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-500/30 transition-colors"
          >
            Claude
          </button>

          <div className="flex-1" />

          {/* Search icon */}
          <button
            onClick={onSearchClick}
            className={`p-2 rounded-lg transition-colors ${
              showSearch
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-white/10'
            }`}
            title="Search (⌘F)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
