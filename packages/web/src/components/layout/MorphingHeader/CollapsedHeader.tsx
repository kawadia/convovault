import { motion } from 'framer-motion';
import UserMenu from '../UserMenu';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface CollapsedHeaderProps {
  onSearchClick: () => void;
  onMenuClick: () => void;
  user: User | null;
  hasActiveFilters: boolean;
}

export default function CollapsedHeader({
  onSearchClick,
  onMenuClick,
  user,
  hasActiveFilters,
}: CollapsedHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="header-glass border-b border-border/50"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-text-primary">DiaStack</span>
          <motion.svg
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 2, 0] }}
            transition={{ delay: 0.2, y: { repeat: 2, duration: 0.3 } }}
            className="w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search icon */}
          <button
            onClick={onSearchClick}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Menu icon */}
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors relative"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            {/* Active filters indicator */}
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
            )}
          </button>

          {/* User avatar */}
          {user && <UserMenu />}
        </div>
      </div>
    </motion.div>
  );
}
