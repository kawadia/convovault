import type { Message as MessageType, ContentBlock } from '@convovault/shared';
import { useState } from 'react';
import Markdown from 'react-markdown';

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
