import type { Message as MessageType, ContentBlock } from '@convovault/shared';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
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
        data-role="user"
        className={`flex justify-end transition-all duration-500 ${
          isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg-primary rounded-2xl' : ''
        }`}
      >
        <div className="max-w-[85%] md:max-w-[75%]">
          <motion.div
            ref={contentRef}
            className="bg-bg-tertiary rounded-2xl px-5 py-4 overflow-hidden"
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
                  className={isLong ? 'cursor-pointer' : ''}
                  onClick={isLong ? () => setIsCollapsed(true) : undefined}
                >
                  <div className="text-text-primary text-[15px] leading-relaxed font-normal">
                    {message.content.map((block, index) => (
                      <UserContentBlock key={index} block={block} />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="cursor-pointer"
                  onClick={handleExpand}
                >
                  <div className="message-vignette text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">
                    {previewText}
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
      data-role="assistant"
      className={`transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg-primary rounded-lg p-2 -m-2' : ''
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
              className={isLong ? 'cursor-pointer' : ''}
              onClick={isLong ? () => setIsCollapsed(true) : undefined}
            >
              <div className="text-text-primary text-[15px] leading-relaxed font-normal">
                {message.content.map((block, index) => (
                  <AssistantContentBlock key={index} block={block} />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="cursor-pointer"
              onClick={handleExpand}
            >
              <div className="message-vignette text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap">
                {previewText}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// User content - simpler rendering
function UserContentBlock({ block }: { block: ContentBlock }) {
  if (block.type === 'code') {
    return (
      <pre className="bg-bg-secondary text-text-primary p-4 rounded-xl overflow-x-auto text-sm my-3 font-mono">
        {block.language && (
          <div className="text-text-muted text-xs mb-2">{block.language}</div>
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
      <pre className="bg-bg-secondary text-text-primary p-4 rounded-xl overflow-x-auto text-sm my-4 border border-border font-mono">
        {block.language && (
          <div className="text-text-muted text-xs mb-2">{block.language}</div>
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
            <pre className="bg-bg-secondary text-text-primary p-4 rounded-xl overflow-x-auto text-sm my-4 border border-border font-mono">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-sm text-text-primary font-mono">
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
            <li className="text-text-primary pl-1">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="my-4 first:mt-0 last:mb-0">{children}</p>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mt-6 mb-3 text-text-primary">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-5 mb-2 text-text-primary">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 text-text-primary">{children}</h3>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-4 my-4 text-text-secondary">
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
            <strong className="font-semibold text-text-primary">{children}</strong>
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
