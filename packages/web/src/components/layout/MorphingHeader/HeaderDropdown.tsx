import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import SearchInput from './SearchInput';
import FilterDropdown from './FilterDropdown';
import SortDropdown, { SortOption } from './SortDropdown';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface HeaderDropdownProps {
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  activeFilters: Set<string>;
  onToggleFilter: (filter: string) => void;
  onClearFilters: () => void;
  onImportClick: () => void;
  user: User | null;
  onLogin: () => void;
  autoFocusSearch?: boolean;
}

export default function HeaderDropdown({
  onClose,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  activeFilters,
  onToggleFilter,
  onClearFilters,
  onImportClick,
  user,
  onLogin,
  autoFocusSearch = false,
}: HeaderDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Dropdown panel */}
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute top-full left-0 right-0 header-glass border-b border-border/50 z-50 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {/* Import / Sign In buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                onImportClick();
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-center"
            >
              Import Chat
            </button>
            {!user && (
              <button
                onClick={() => {
                  onLogin();
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-bg-secondary text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in
              </button>
            )}
          </div>

          {/* Search */}
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            autoFocus={autoFocusSearch}
          />

          {/* Filters + Sort */}
          <div className="flex gap-2">
            <FilterDropdown
              activeFilters={activeFilters}
              onToggleFilter={onToggleFilter}
              onClear={onClearFilters}
            />
            <SortDropdown value={sortBy} onChange={onSortChange} />
          </div>
        </div>
      </motion.div>
    </>
  );
}
