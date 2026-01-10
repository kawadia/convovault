import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useScrollPosition } from '../../../hooks/useScrollPosition';
import ExpandedHeader from './ExpandedHeader';
import CollapsedHeader from './CollapsedHeader';
import HeaderDropdown from './HeaderDropdown';
import { SortOption } from './SortDropdown';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface MorphingHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  activeFilters: Set<string>;
  onToggleFilter: (filter: string) => void;
  onClearFilters: () => void;
  onImportClick: () => void;
  user: User | null;
  isAuthLoading: boolean;
  onLogin: () => void;
}

// Mobile breakpoint (matches Tailwind's md)
const MOBILE_BREAKPOINT = 768;
const SCROLL_THRESHOLD = 100;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    // Set initial value
    setIsMobile(mql.matches);

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export default function MorphingHeader({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  activeFilters,
  onToggleFilter,
  onClearFilters,
  onImportClick,
  user,
  isAuthLoading,
  onLogin,
}: MorphingHeaderProps) {
  const isMobile = useIsMobile();
  const { isScrolled } = useScrollPosition({
    threshold: SCROLL_THRESHOLD,
    enabled: isMobile,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);

  // Close dropdown when scrolling down
  useEffect(() => {
    if (isScrolled && isDropdownOpen) {
      // Optional: auto-close dropdown on scroll
      // setIsDropdownOpen(false);
    }
  }, [isScrolled, isDropdownOpen]);

  // Close dropdown when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsDropdownOpen(false);
    }
  }, [isMobile]);

  const handleSearchClick = () => {
    setAutoFocusSearch(true);
    setIsDropdownOpen(true);
  };

  const handleMenuClick = () => {
    setAutoFocusSearch(false);
    setIsDropdownOpen(true);
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
    setAutoFocusSearch(false);
  };

  // On mobile + scrolled: show collapsed header
  // Otherwise: show expanded header
  const showCollapsed = isMobile && isScrolled;

  return (
    <header className="sticky top-0 z-30">
      <AnimatePresence mode="wait">
        {showCollapsed ? (
          <CollapsedHeader
            key="collapsed"
            onSearchClick={handleSearchClick}
            onMenuClick={handleMenuClick}
            user={user}
            hasActiveFilters={activeFilters.size > 0}
          />
        ) : (
          <ExpandedHeader
            key="expanded"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            sortBy={sortBy}
            onSortChange={onSortChange}
            activeFilters={activeFilters}
            onToggleFilter={onToggleFilter}
            onClearFilters={onClearFilters}
            onImportClick={onImportClick}
            user={user}
            isAuthLoading={isAuthLoading}
            onLogin={onLogin}
          />
        )}
      </AnimatePresence>

      {/* Dropdown overlay (only for collapsed state) */}
      <AnimatePresence>
        {showCollapsed && isDropdownOpen && (
          <HeaderDropdown
            onClose={handleDropdownClose}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            sortBy={sortBy}
            onSortChange={onSortChange}
            activeFilters={activeFilters}
            onToggleFilter={onToggleFilter}
            onClearFilters={onClearFilters}
            onImportClick={onImportClick}
            user={user}
            onLogin={onLogin}
            autoFocusSearch={autoFocusSearch}
          />
        )}
      </AnimatePresence>
    </header>
  );
}
