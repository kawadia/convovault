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
      className={`group ${isUser ? 'bg-bg-tertiary' : 'bg-bg-secondary'} rounded-lg p-4 transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isUser
              ? 'bg-accent text-white'
              : 'bg-text-muted text-white'
          }`}
          title={displayName}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-text-primary">
              {displayName}
            </span>
            {isLong && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-bg-tertiary text-text-secondary hover:bg-bg-hover transition-colors"
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
              className="text-text-secondary italic cursor-pointer hover:text-text-primary"
              onClick={() => setIsCollapsed(false)}
            >
              {previewText}...
              <span className="ml-2 text-xs text-accent">
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
      <pre className="bg-black/50 text-text-primary p-4 rounded-lg overflow-x-auto text-sm border border-border">
        {block.language && (
          <div className="text-text-muted text-xs mb-2">{block.language}</div>
        )}
        <code>{block.content}</code>
      </pre>
    );
  }

  // Default: text - render as markdown
  return (
    <div className="text-text-secondary prose prose-sm prose-invert max-w-none">
      <Markdown
        components={{
          // Style code blocks within markdown
          pre: ({ children }) => (
            <pre className="bg-black/50 text-text-primary p-4 rounded-lg overflow-x-auto text-sm border border-border">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-bg-tertiary px-1 py-0.5 rounded text-sm text-text-primary">
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
            <li className="text-text-secondary">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="my-2">{children}</p>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-text-primary">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-3 mb-2 text-text-primary">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold mt-3 mb-1 text-text-primary">{children}</h3>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent pl-4 my-2 italic text-text-secondary">
              {children}
            </blockquote>
          ),
          // Style links
          a: ({ href, children }) => (
            <a href={href} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
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
