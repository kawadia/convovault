import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useScrollPosition } from '../../../hooks/useScrollPosition';
import ExpandedChatHeader from './ExpandedChatHeader';
import CollapsedChatHeader from './CollapsedChatHeader';
import ChatHeaderDropdown from './ChatHeaderDropdown';

interface ChatHeaderProps {
  chat: {
    title: string;
    sourceUrl: string;
    participants?: {
      user: string;
      assistant: string;
    };
  };
  longMessageCount: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  searchBar: React.ReactNode;
}

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
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export default function ChatHeader({
  chat,
  longMessageCount,
  onCollapseAll,
  onExpandAll,
  showSearch,
  onToggleSearch,
  searchBar,
}: ChatHeaderProps) {
  const isMobile = useIsMobile();
  const { isScrolled } = useScrollPosition({
    threshold: SCROLL_THRESHOLD,
    enabled: isMobile,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Close dropdown when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsDropdownOpen(false);
    }
  }, [isMobile]);

  const handleSearchClick = () => {
    onToggleSearch();
  };

  const handleMenuClick = () => {
    setIsDropdownOpen(true);
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  // On mobile + scrolled: show collapsed header
  const showCollapsed = isMobile && isScrolled;

  return (
    <header className="sticky top-0 z-20">
      <AnimatePresence mode="wait">
        {showCollapsed ? (
          <CollapsedChatHeader
            key="collapsed"
            onSearchClick={handleSearchClick}
            onMenuClick={handleMenuClick}
            showSearch={showSearch}
          />
        ) : (
          <ExpandedChatHeader
            key="expanded"
            chat={chat}
            longMessageCount={longMessageCount}
            onCollapseAll={onCollapseAll}
            onExpandAll={onExpandAll}
            showSearch={showSearch}
            onToggleSearch={onToggleSearch}
          />
        )}
      </AnimatePresence>

      {/* Dropdown overlay (only for collapsed state) */}
      <AnimatePresence>
        {showCollapsed && isDropdownOpen && (
          <ChatHeaderDropdown
            onClose={handleDropdownClose}
            chat={chat}
            longMessageCount={longMessageCount}
            onCollapseAll={onCollapseAll}
            onExpandAll={onExpandAll}
          />
        )}
      </AnimatePresence>

      {/* Search bar (rendered below header) */}
      {showSearch && searchBar}
    </header>
  );
}
