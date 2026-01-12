import { useState } from 'react';
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
  currentSpeaker?: 'user' | 'assistant';
}

const SCROLL_THRESHOLD = 100;

export default function ChatHeader({
  chat,
  longMessageCount,
  onCollapseAll,
  onExpandAll,
  showSearch,
  onToggleSearch,
  searchBar,
  currentSpeaker = 'assistant',
}: ChatHeaderProps) {
  // Get display name for current speaker
  const speakerName = currentSpeaker === 'assistant'
    ? (chat.participants?.assistant || 'Claude')
    : (chat.participants?.user || 'User');
  const { isScrolled } = useScrollPosition({
    threshold: SCROLL_THRESHOLD,
    enabled: true,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSearchClick = () => {
    onToggleSearch();
  };

  const handleMenuClick = () => {
    setIsDropdownOpen(true);
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  // Show collapsed header when scrolled past threshold
  const showCollapsed = isScrolled;

  return (
    <header className="sticky top-0 z-20">
      <AnimatePresence mode="wait">
        {showCollapsed ? (
          <CollapsedChatHeader
            key="collapsed"
            onSearchClick={handleSearchClick}
            onMenuClick={handleMenuClick}
            showSearch={showSearch}
            currentSpeaker={speakerName}
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
