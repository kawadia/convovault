import type { Message as MessageType } from '@convovault/shared';
import Message from './Message';

interface ChatViewerProps {
  messages: MessageType[];
}

export default function ChatViewer({ messages }: ChatViewerProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        No messages in this conversation.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  );
}
