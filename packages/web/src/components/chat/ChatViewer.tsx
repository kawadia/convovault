import type { Message as MessageType, Participants } from '@convovault/shared';
import { useState } from 'react';
import Message from './Message';

interface ChatViewerProps {
  messages: MessageType[];
  participants?: Participants;
  highlightedMessageIndex?: number | null;
}

// Threshold must match Message.tsx
const LONG_MESSAGE_THRESHOLD = 500;

function getMessageLength(message: MessageType): number {
  return message.content.reduce((sum, block) => sum + block.content.length, 0);
}

export default function ChatViewer({ messages, participants, highlightedMessageIndex }: ChatViewerProps) {
  const [globalFoldState, setGlobalFoldState] = useState<'all-folded' | 'all-unfolded' | null>(null);

  // Count how many messages are "long"
  const longMessageCount = messages.filter(m => getMessageLength(m) > LONG_MESSAGE_THRESHOLD).length;

  if (messages.length === 0) {
    return (
      <div className="text-center text-text-secondary py-12">
        No messages in this conversation.
      </div>
    );
  }

  const handleFoldAll = () => {
    setGlobalFoldState('all-folded');
  };

  const handleUnfoldAll = () => {
    setGlobalFoldState('all-unfolded');
  };

  return (
    <div className="space-y-4">
      {/* Toolbar with fold controls */}
      {longMessageCount > 0 && (
        <div className="sticky top-0 z-10 bg-bg-primary py-2 px-1 -mx-1 flex items-center justify-between border-b border-border">
          <span className="text-sm text-text-secondary">
            {messages.length} messages ({longMessageCount} long)
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleFoldAll}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Fold All
            </button>
            <button
              onClick={handleUnfoldAll}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Unfold All
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-6">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            globalFoldState={globalFoldState}
            participants={participants}
            isHighlighted={highlightedMessageIndex === message.index}
          />
        ))}
      </div>
    </div>
  );
}
