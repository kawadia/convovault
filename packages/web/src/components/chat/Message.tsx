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
  const previewText = message.content[0]?.content.substring(0, 200).replace(/\n/g, ' ') || '';

  if (isUser) {
    // User message: right-aligned with dark rounded background, WHITE text
    return (
      <div
        ref={messageRef}
        id={`msg-${message.index}`}
        className={`flex justify-end transition-all duration-500 ${
          isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-[#2f2f2f] rounded-2xl' : ''
        }`}
      >
        <div className="max-w-[85%] md:max-w-[75%]">
          {/* Fold button for long messages */}
          {isLong && (
            <div className="flex justify-end mb-1">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md text-[#999] hover:text-[#ccc] transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
          )}

          <div className="bg-[#403a2e] rounded-2xl px-5 py-4">
            {!isCollapsed ? (
              <div className="text-white text-[15px] leading-relaxed font-normal">
                {message.content.map((block, index) => (
                  <UserContentBlock key={index} block={block} />
                ))}
              </div>
            ) : (
              <div
                className="text-white text-[15px] leading-relaxed cursor-pointer"
                onClick={() => setIsCollapsed(false)}
              >
                {previewText}...
                <span className="ml-2 text-xs text-[#999]">(click to expand)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message: left-aligned, no background, same text color
  return (
    <div
      ref={messageRef}
      id={`msg-${message.index}`}
      className={`transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-[#2f2f2f] rounded-lg p-2 -m-2' : ''
      }`}
    >
      {/* Fold button for long messages */}
      {isLong && (
        <div className="flex justify-start mb-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md text-[#888] hover:text-[#aaa] transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      )}

      {!isCollapsed ? (
        <div className="text-[#ececec] text-[15px] leading-relaxed font-normal">
          {message.content.map((block, index) => (
            <AssistantContentBlock key={index} block={block} />
          ))}
        </div>
      ) : (
        <div
          className="text-[#ececec] text-[15px] leading-relaxed cursor-pointer"
          onClick={() => setIsCollapsed(false)}
        >
          {previewText}...
          <span className="ml-2 text-xs text-[#888]">(click to expand)</span>
        </div>
      )}
    </div>
  );
}

// User content - white text, simpler rendering
function UserContentBlock({ block }: { block: ContentBlock }) {
  if (block.type === 'code') {
    return (
      <pre className="bg-[#2a2520] text-white p-4 rounded-xl overflow-x-auto text-sm my-3 font-mono">
        {block.language && (
          <div className="text-[#999] text-xs mb-2">{block.language}</div>
        )}
        <code>{block.content}</code>
      </pre>
    );
  }

  // Simple text rendering for user messages
  return (
    <div className="whitespace-pre-wrap">
      {block.content.split('\n').map((line, i, arr) => (
        <span key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}

// Assistant content - with full markdown rendering
function AssistantContentBlock({ block }: { block: ContentBlock }) {
  if (block.type === 'code') {
    return (
      <pre className="bg-[#1a1a1a] text-[#ececec] p-4 rounded-xl overflow-x-auto text-sm my-4 border border-[#333] font-mono">
        {block.language && (
          <div className="text-[#888] text-xs mb-2">{block.language}</div>
        )}
        <code>{block.content}</code>
      </pre>
    );
  }

  // Full markdown rendering for assistant messages
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <Markdown
        components={{
          // Style code blocks within markdown
          pre: ({ children }) => (
            <pre className="bg-[#1a1a1a] text-[#ececec] p-4 rounded-xl overflow-x-auto text-sm my-4 border border-[#333] font-mono">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-[#3a3a3a] px-1.5 py-0.5 rounded text-sm text-[#ececec] font-mono">
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
            <li className="text-[#ececec] pl-1">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="my-4 first:mt-0 last:mb-0">{children}</p>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mt-6 mb-3 text-[#ececec]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-5 mb-2 text-[#ececec]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 text-[#ececec]">{children}</h3>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#555] pl-4 my-4 text-[#bbb]">
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
            <strong className="font-semibold text-[#ececec]">{children}</strong>
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
