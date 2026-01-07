import type { Message as MessageType } from '@convovault/shared';
import Message from './Message';

interface ChatViewerProps {
  messages: MessageType[];
  highlightedMessageIndex?: number | null;
  globalFoldState?: 'all-folded' | 'all-unfolded' | null;
}

export default function ChatViewer({ messages, highlightedMessageIndex, globalFoldState }: ChatViewerProps) {
  // Disable auto-collapse when:
  // - A message is highlighted (during search)
  // - User clicked "Expand All" (don't re-collapse what they just expanded)
  const autoCollapseEnabled = highlightedMessageIndex === null && globalFoldState !== 'all-unfolded';

  if (messages.length === 0) {
    return (
      <div className="text-center text-text-secondary py-12">
        No messages in this conversation.
      </div>
    );
  }

  return (
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
  );
}
