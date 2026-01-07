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

export default function Message({ message, globalFoldState, isHighlighted }: MessageProps) {
  const isLong = getMessageLength(message) > LONG_MESSAGE_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(isLong);
  const isUser = message.role === 'user';
  const messageRef = useRef<HTMLDivElement>(null);

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

  if (isUser) {
    // User message: right-aligned with dark rounded background
    return (
      <div
        ref={messageRef}
        id={`msg-${message.index}`}
        className={`flex justify-end transition-all duration-500 ${
          isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg-primary rounded-2xl' : ''
        }`}
      >
        <div className="max-w-[85%] md:max-w-[75%]">
          {/* Fold button for long messages */}
          {isLong && (
            <div className="flex justify-end mb-1">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md text-text-muted hover:text-text-secondary transition-colors"
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
            </div>
          )}

          <div className="bg-[#3d3929] rounded-2xl px-5 py-4">
            {!isCollapsed && (
              <div className="text-[#e8e6e3] text-[15px] leading-relaxed">
                {message.content.map((block, index) => (
                  <ContentBlockRenderer key={index} block={block} />
                ))}
              </div>
            )}

            {isCollapsed && (
              <div
                className="text-[#a8a49c] italic cursor-pointer hover:text-[#e8e6e3]"
                onClick={() => setIsCollapsed(false)}
              >
                {previewText}...
                <span className="ml-2 text-xs text-accent">(expand)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message: left-aligned, no background
  return (
    <div
      ref={messageRef}
      id={`msg-${message.index}`}
      className={`transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg-primary rounded-lg p-2 -m-2' : ''
      }`}
    >
      {/* Fold button for long messages */}
      {isLong && (
        <div className="flex justify-start mb-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md text-text-muted hover:text-text-secondary transition-colors"
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
        </div>
      )}

      {!isCollapsed && (
        <div className="text-[#e8e6e3] text-[15px] leading-relaxed">
          {message.content.map((block, index) => (
            <ContentBlockRenderer key={index} block={block} />
          ))}
        </div>
      )}

      {isCollapsed && (
        <div
          className="text-[#a8a49c] italic cursor-pointer hover:text-[#e8e6e3]"
          onClick={() => setIsCollapsed(false)}
        >
          {previewText}...
          <span className="ml-2 text-xs text-accent">(expand)</span>
        </div>
      )}
    </div>
  );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  if (block.type === 'code') {
    return (
      <pre className="bg-[#1a1a1a] text-[#e8e6e3] p-4 rounded-xl overflow-x-auto text-sm my-4 border border-[#333]">
        {block.language && (
          <div className="text-[#888] text-xs mb-2 font-mono">{block.language}</div>
        )}
        <code className="font-mono">{block.content}</code>
      </pre>
    );
  }

  // Default: text - render as markdown
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <Markdown
        components={{
          // Style code blocks within markdown
          pre: ({ children }) => (
            <pre className="bg-[#1a1a1a] text-[#e8e6e3] p-4 rounded-xl overflow-x-auto text-sm my-4 border border-[#333]">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-[#2a2a2a] px-1.5 py-0.5 rounded text-sm text-[#e8e6e3] font-mono">
                  {children}
                </code>
              );
            }
            return <code className="font-mono">{children}</code>;
          },
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-2 my-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-2 my-4">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[#e8e6e3] pl-1">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="my-4 first:mt-0 last:mb-0">{children}</p>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mt-6 mb-3 text-[#e8e6e3]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-5 mb-2 text-[#e8e6e3]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 text-[#e8e6e3]">{children}</h3>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#555] pl-4 my-4 text-[#a8a49c]">
              {children}
            </blockquote>
          ),
          // Style links
          a: ({ href, children }) => (
            <a href={href} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Style strong/bold
          strong: ({ children }) => (
            <strong className="font-semibold text-[#e8e6e3]">{children}</strong>
          ),
          // Style emphasis/italic
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {block.content}
      </Markdown>
    </div>
  );
}
