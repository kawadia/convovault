import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface ChatHeaderDropdownProps {
  onClose: () => void;
  chat: {
    title: string;
    sourceUrl: string;
  };
  longMessageCount: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

export default function ChatHeaderDropdown({
  onClose,
  chat,
  longMessageCount,
  onCollapseAll,
  onExpandAll,
}: ChatHeaderDropdownProps) {
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
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {/* Title and View on Claude */}
          <div>
            <h2 className="text-lg font-medium text-text-primary line-clamp-2">
              {chat.title}
            </h2>
            <a
              href={chat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent transition-colors mt-1"
              onClick={onClose}
            >
              View on Claude
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Fold controls */}
          {longMessageCount > 0 && (
            <div className="flex items-center gap-3 pt-3 border-t border-border/50">
              <span className="text-sm text-text-muted mr-auto">
                {longMessageCount} long {longMessageCount === 1 ? 'message' : 'messages'}
              </span>
              <button
                onClick={() => {
                  onCollapseAll();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Collapse All
              </button>
              <button
                onClick={() => {
                  onExpandAll();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/10 transition-colors"
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
    </>
  );
}
