import type { Message as MessageType, ContentBlock, Participants } from '@convovault/shared';
import { useEffect, useState, useRef } from 'react';
import Markdown from 'react-markdown';

// Threshold for considering a message "long"
const LONG_MESSAGE_THRESHOLD = 500;

interface MessageProps {
  message: MessageType;
  globalFoldState?: 'all-folded' | 'all-unfolded' | null;
  participants?: Participants;
  isHighlighted?: boolean;
}

function getMessageLength(message: MessageType): number {
  return message.content.reduce((sum, block) => sum + block.content.length, 0);
}

export default function Message({ message, globalFoldState, participants, isHighlighted }: MessageProps) {
  const isLong = getMessageLength(message) > LONG_MESSAGE_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(isLong);
  const isUser = message.role === 'user';
  const messageRef = useRef<HTMLDivElement>(null);

  // Use participant names if available, otherwise fall back to defaults
  const displayName = isUser
    ? (participants?.user || 'User')
    : (participants?.assistant || 'Assistant');
  const initials = displayName.charAt(0).toUpperCase();

  // Respond to global fold/unfold commands
  useEffect(() => {
    if (globalFoldState === 'all-folded' && isLong) {
      setIsCollapsed(true);
    } else if (globalFoldState === 'all-unfolded') {
      setIsCollapsed(false);
    }
  }, [globalFoldState, isLong]);

  // Scroll into view and unfold when highlighted
  useEffect(() => {
    if (isHighlighted && messageRef.current) {
      // Unfold if collapsed
      if (isCollapsed) {
        setIsCollapsed(false);
      }
      // Scroll into view with some offset
      setTimeout(() => {
        messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isHighlighted]);

  // Generate preview text for collapsed state
  const previewText = message.content[0]?.content.substring(0, 150).replace(/\n/g, ' ') || '';

  return (
    <div
      ref={messageRef}
      id={`msg-${message.index}`}
      className={`group ${isUser ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'} rounded-lg p-4 shadow-sm transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-yellow-400 ring-offset-2 dark:ring-offset-gray-900 bg-yellow-50 dark:bg-yellow-900/30' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-purple-500 text-white'
          }`}
          title={displayName}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {displayName}
            </span>
            {isLong && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {isCollapsed ? 'Expand' : 'Fold'}
              </button>
            )}
          </div>

          {!isCollapsed && (
            <div className="space-y-3">
              {message.content.map((block, index) => (
                <ContentBlockRenderer key={index} block={block} />
              ))}
            </div>
          )}

          {isCollapsed && (
            <div
              className="text-gray-500 dark:text-gray-400 italic cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
              onClick={() => setIsCollapsed(false)}
            >
              {previewText}...
              <span className="ml-2 text-xs text-indigo-500 dark:text-indigo-400">
                (click to expand)
              </span>
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

  // Default: text - render as markdown
  return (
    <div className="text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
      <Markdown
        components={{
          // Style code blocks within markdown
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">
                  {children}
                </code>
              );
            }
            return <code>{children}</code>;
          },
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700 dark:text-gray-300">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="my-2">{children}</p>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold mt-3 mb-1">{children}</h3>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2 italic">
              {children}
            </blockquote>
          ),
          // Style links
          a: ({ href, children }) => (
            <a href={href} className="text-indigo-600 dark:text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {block.content}
      </Markdown>
    </div>
  );
}
