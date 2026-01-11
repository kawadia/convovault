import { Link } from 'react-router';
import { motion } from 'framer-motion';

interface ExpandedChatHeaderProps {
  chat: {
    title: string;
    sourceUrl: string;
  };
  longMessageCount: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  showSearch: boolean;
  onToggleSearch: () => void;
}

export default function ExpandedChatHeader({
  chat,
  longMessageCount,
  onCollapseAll,
  onExpandAll,
  showSearch,
  onToggleSearch,
}: ExpandedChatHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="bg-bg-primary/95 backdrop-blur-sm"
    >
      <div className="max-w-3xl mx-auto px-6 py-3">
        {/* Top row: back button, title, Claude button, search */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-[19px] font-medium text-text-primary truncate">
              {chat.title}
            </h1>
            {/* View on Claude link */}
            <a
              href={chat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent transition-colors"
            >
              View on Claude
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Claude button */}
          <a
            href={chat.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-500/30 transition-colors hidden sm:block"
          >
            Claude
          </a>

          {/* Search toggle */}
          <button
            onClick={onToggleSearch}
            className={`p-2 rounded-lg transition-colors ${
              showSearch
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }`}
            title="Search (⌘F)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Second row: fold controls */}
        {longMessageCount > 0 && (
          <div className="flex items-center gap-3 mt-3 pb-3 border-b border-border">
            <span className="text-sm text-text-muted mr-auto">
              {longMessageCount} long {longMessageCount === 1 ? 'message' : 'messages'}
            </span>
            <button
              onClick={onCollapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Collapse All
            </button>
            <button
              onClick={onExpandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Expand All
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
