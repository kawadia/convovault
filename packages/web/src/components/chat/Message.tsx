import type { Message as MessageType, ContentBlock } from '@convovault/shared';
import { useState } from 'react';

interface MessageProps {
  message: MessageType;
}

export default function Message({ message }: MessageProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div
      id={`msg-${message.index}`}
      className={`group ${isUser ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'} rounded-lg p-4 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-purple-500 text-white'
          }`}
        >
          {isUser ? 'U' : 'A'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {isUser ? 'User' : 'Assistant'}
            </span>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-400 hover:text-gray-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>

          {!isCollapsed && (
            <div className="space-y-3">
              {message.content.map((block, index) => (
                <ContentBlockRenderer key={index} block={block} />
              ))}
            </div>
          )}

          {isCollapsed && (
            <div className="text-gray-500 dark:text-gray-400 italic">
              {message.content[0]?.content.substring(0, 100)}...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  if (block.type === 'code') {
    return (
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        {block.language && (
          <div className="text-gray-400 text-xs mb-2">{block.language}</div>
        )}
        <code>{block.content}</code>
      </pre>
    );
  }

  // Default: text
  return (
    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {block.content}
    </div>
  );
}
