import type { Message as MessageType } from '@convovault/shared';
import { useState, useCallback } from 'react';
import Message from './Message';

interface ChatViewerProps {
  messages: MessageType[];
  highlightedMessageIndex?: number | null;
}

// Threshold must match Message.tsx
const LONG_MESSAGE_THRESHOLD = 500;

function getMessageLength(message: MessageType): number {
  return message.content.reduce((sum, block) => sum + block.content.length, 0);
}

export default function ChatViewer({ messages, highlightedMessageIndex }: ChatViewerProps) {
  const [globalFoldState, setGlobalFoldState] = useState<'all-folded' | 'all-unfolded' | null>(null);

  // Disable auto-collapse when a message is highlighted (during search)
  const autoCollapseEnabled = highlightedMessageIndex === null;

  // Count how many messages are "long"
  const longMessageCount = messages.filter(m => getMessageLength(m) > LONG_MESSAGE_THRESHOLD).length;

  // Reset globalFoldState after triggering to allow repeated clicks
  const handleCollapseAll = useCallback(() => {
    setGlobalFoldState(null); // Reset first to ensure change is detected
    setTimeout(() => setGlobalFoldState('all-folded'), 0);
  }, []);

  const handleExpandAll = useCallback(() => {
    setGlobalFoldState(null); // Reset first to ensure change is detected
    setTimeout(() => setGlobalFoldState('all-unfolded'), 0);
  }, []);

  if (messages.length === 0) {
    return (
      <div className="text-center text-text-secondary py-12">
        No messages in this conversation.
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar with fold controls - only show if there are long messages */}
      {longMessageCount > 0 && (
        <div className="flex items-center justify-end gap-3 mb-8 pb-4 border-b border-border">
          <span className="text-sm text-text-muted mr-auto">
            {longMessageCount} long {longMessageCount === 1 ? 'message' : 'messages'}
          </span>
          <button
            onClick={handleCollapseAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Collapse All
          </button>
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Expand All
          </button>
        </div>
      )}

      {/* Messages with more vertical spacing */}
      <div className="space-y-8">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            globalFoldState={globalFoldState}
            isHighlighted={highlightedMessageIndex === message.index}
            autoCollapseEnabled={autoCollapseEnabled}
          />
        ))}
      </div>
    </div>
  );
}
