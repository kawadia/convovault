import type { Message as MessageType, ContentBlock } from '@convovault/shared';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { analyzeMessage, getMetadataPillText } from '../../utils/messageAnalytics';
import { getPreviewText } from '../../utils/textPreview';
import { useIntersectionCollapse } from '../../hooks/useIntersectionCollapse';

// Threshold for considering a message "long"
const LONG_MESSAGE_THRESHOLD = 500;

// Spring animation config
const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};

interface MessageProps {
  message: MessageType;
  globalFoldState?: 'all-folded' | 'all-unfolded' | null;
  isHighlighted?: boolean;
  autoCollapseEnabled?: boolean;
}

function getMessageLength(message: MessageType): number {
  return message.content.reduce((sum, block) => sum + block.content.length, 0);
}

export default function Message({
  message,
  globalFoldState,
  isHighlighted,
  autoCollapseEnabled = true,
}: MessageProps) {
  const isLong = getMessageLength(message) > LONG_MESSAGE_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(isLong);
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);

  // Compute analytics once (memoized)
  const analytics = useMemo(() => analyzeMessage(message), [message]);
  const pillText = getMetadataPillText(analytics, isCollapsed);

  // Preview text for collapsed state
  const previewText = useMemo(
    () => getPreviewText(message.content[0]?.content || ''),
    [message]
  );

  // Auto-collapse when scrolled out of view
  const intersectionRef = useIntersectionCollapse({
    isExpanded: !isCollapsed,
    onCollapse: () => setIsCollapsed(true),
    enabled: autoCollapseEnabled && isLong,
  });

  // Handle expansion with smart scroll
  const handleExpand = useCallback(() => {
    setIsCollapsed(false);

    // After animation, check if we need to scroll
    setTimeout(() => {
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // If content would extend beyond comfortable reading position, scroll
        if (rect.height > viewportHeight * 0.6 || rect.top < viewportHeight * 0.15) {
          const targetPosition = viewportHeight * 0.15;
          const scrollY = window.scrollY + rect.top - targetPosition;
          window.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' });
        }
      }
    }, 350);
  }, []);

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
    if (isHighlighted && intersectionRef.current) {
      if (isCollapsed) {
        setIsCollapsed(false);
      }
      setTimeout(() => {
        intersectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isHighlighted, isCollapsed]);

  if (isUser) {
    return (
      <div
        ref={intersectionRef}
        id={`msg-${message.index}`}
        className={`flex justify-end transition-all duration-500 ${
          isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-[#2f2f2f] rounded-2xl' : ''
        }`}
      >
        <div className="max-w-[85%] md:max-w-[75%]">
          <motion.div
            ref={contentRef}
            className="bg-[#403a2e] rounded-2xl px-5 py-4 overflow-hidden"
            layout
            transition={springTransition}
          >
            <AnimatePresence mode="wait" initial={false}>
              {!isCollapsed ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="text-white text-[15px] leading-relaxed font-normal">
                    {message.content.map((block, index) => (
                      <UserContentBlock key={index} block={block} />
                    ))}
                  </div>

                  {/* Collapse pill at bottom for long messages */}
                  {isLong && (
                    <button
                      onClick={() => setIsCollapsed(true)}
                      className="mt-4 mx-auto block px-3 py-1.5 text-xs rounded-full
                                 bg-[#2a2520]/80 text-[#bbb] hover:text-white
                                 hover:bg-[#2a2520] transition-colors"
                    >
                      {pillText}
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="message-preview-container cursor-pointer"
                  onClick={handleExpand}
                >
                  <div className="message-vignette text-white text-[15px] leading-relaxed whitespace-pre-wrap">
                    {previewText}
                  </div>

                  {/* Metadata pill floating in fade area */}
                  <div className="message-metadata-pill">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
                                     rounded-full bg-[#2a2520]/90 text-[#ccc]
                                     backdrop-blur-sm shadow-lg">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {pillText}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  // Assistant message: left-aligned, no background
  return (
    <div
      ref={intersectionRef}
      id={`msg-${message.index}`}
      className={`transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-[#2f2f2f] rounded-lg p-2 -m-2' : ''
      }`}
    >
      <motion.div
        ref={contentRef}
        layout
        transition={springTransition}
        className="overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="text-[#ececec] text-[15px] leading-relaxed font-normal">
                {message.content.map((block, index) => (
                  <AssistantContentBlock key={index} block={block} />
                ))}
              </div>

              {/* Collapse pill at bottom for long messages */}
              {isLong && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="mt-4 mx-auto block px-3 py-1.5 text-xs rounded-full
                             bg-[#2a2a2a] text-[#888] hover:text-[#ccc]
                             hover:bg-[#333] transition-colors border border-[#444]"
                >
                  {pillText}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="message-preview-container cursor-pointer"
              onClick={handleExpand}
            >
              <div className="message-vignette text-[#ececec] text-[15px] leading-relaxed whitespace-pre-wrap">
                {previewText}
              </div>

              {/* Metadata pill floating in fade area */}
              <div className="message-metadata-pill">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 rounded-full bg-[#2a2a2a]/90 text-[#aaa]
                                 backdrop-blur-sm shadow-lg border border-[#444]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {pillText}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
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
