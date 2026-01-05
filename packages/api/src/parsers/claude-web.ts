import type {
  ChatParser,
  ChatTranscript,
  Message,
  ContentBlock,
} from '@convovault/shared';

/**
 * Parser for claude.ai shared conversation pages
 *
 * Extracts conversation data from the HTML of share.claude.ai pages.
 * Uses string parsing since we're in a Workers environment without full DOM.
 */
export const claudeWebParser: ChatParser = {
  source: 'claude-web',

  canParse(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'claude.ai' && parsed.pathname.startsWith('/share/')
      );
    } catch {
      return false;
    }
  },

  parse(html: string, url: string): ChatTranscript {
    const fetchedAt = Date.now();
    const title = extractTitle(html);
    const messages = extractMessages(html);
    const wordCount = calculateWordCount(messages);

    return {
      id: generateId(url),
      source: 'claude-web',
      sourceUrl: url,
      title,
      fetchedAt,
      messageCount: messages.length,
      wordCount,
      messages,
    };
  },
};

/**
 * Generate a deterministic ID from the URL
 */
function generateId(url: string): string {
  // Simple hash function for deterministic ID
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `claude-web-${Math.abs(hash).toString(36)}`;
}

/**
 * Extract title from the HTML page
 */
function extractTitle(html: string): string {
  // Match <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch?.[1]) {
    return 'Untitled Conversation';
  }

  // Remove " | Claude" suffix if present
  let title = titleMatch[1].trim();
  const suffix = ' | Claude';
  if (title.endsWith(suffix)) {
    title = title.slice(0, -suffix.length);
  }

  return title || 'Untitled Conversation';
}

/**
 * Extract messages from HTML
 *
 * Supports two extraction strategies:
 * 1. Server-rendered HTML with data-test-render-count attribute
 * 2. Client-rendered HTML with font-user-message and data-is-streaming
 */
function extractMessages(html: string): Message[] {
  // Try strategy 1: data-test-render-count (test fixtures, some server renders)
  let messages = extractMessagesWithRenderCount(html);

  // If no messages found, try strategy 2: class-based extraction
  if (messages.length === 0) {
    messages = extractMessagesWithClasses(html);
  }

  return messages;
}

/**
 * Strategy 1: Extract using data-test-render-count attribute
 */
function extractMessagesWithRenderCount(html: string): Message[] {
  const messages: Message[] = [];

  const blockRegex =
    /<div\s+data-test-render-count="2"[^>]*>([\s\S]*?)(?=<div\s+data-test-render-count="2"|<\/body>|$)/gi;

  let match;
  let index = 0;

  while ((match = blockRegex.exec(html)) !== null) {
    const blockContent = match[1];
    if (!blockContent) continue;

    const isUser = blockContent.includes('font-user-message');
    const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
    const textContent = extractTextContent(blockContent);

    if (!textContent.trim()) continue;

    const contentBlocks = extractContentBlocks(blockContent, textContent);

    messages.push({
      id: `msg-${index}`,
      index,
      role,
      content: contentBlocks,
    });

    index++;
  }

  return messages;
}

/**
 * Strategy 2: Extract using class names (for client-rendered HTML)
 * - User messages: elements with font-user-message class
 * - Assistant messages: elements with data-is-streaming attribute
 */
function extractMessagesWithClasses(html: string): Message[] {
  const messages: Message[] = [];

  // Find user messages (font-user-message class)
  const userMsgRegex = /<div[^>]*class="[^"]*font-user-message[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const userMessages: Array<{ content: string; position: number }> = [];

  let match;
  while ((match = userMsgRegex.exec(html)) !== null) {
    const content = extractTextContent(match[1] || '');
    if (content.trim()) {
      userMessages.push({ content, position: match.index });
    }
  }

  // Find assistant messages (data-is-streaming attribute with group relative pb-3 class)
  const assistantMsgRegex = /<div[^>]*class="group relative pb-3"[^>]*data-is-streaming[^>]*>([\s\S]*?)(?=<div[^>]*class="group relative pb-3"|<div[^>]*class="[^"]*font-user-message|$)/gi;
  const assistantMessages: Array<{ content: string; position: number }> = [];

  while ((match = assistantMsgRegex.exec(html)) !== null) {
    const blockHtml = match[1] || '';
    const content = extractTextContent(blockHtml);
    if (content.trim() && content.length > 10) { // Assistant messages should have substantial content
      assistantMessages.push({
        content,
        position: match.index
      });
    }
  }

  // Merge and sort by position
  const allMessages = [
    ...userMessages.map(m => ({ ...m, role: 'user' as const })),
    ...assistantMessages.map(m => ({ ...m, role: 'assistant' as const })),
  ].sort((a, b) => a.position - b.position);

  // Convert to Message objects
  allMessages.forEach((msg, index) => {
    messages.push({
      id: `msg-${index}`,
      index,
      role: msg.role,
      content: [{ type: 'text', content: msg.content }],
    });
  });

  return messages;
}

/**
 * Extract text content from HTML, stripping tags
 */
function extractTextContent(html: string): string {
  // Remove script and style tags completely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,
    (entity) => entities[entity] || entity
  );
}

/**
 * Extract content blocks (text and code) from message HTML
 */
function extractContentBlocks(html: string, textContent: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Check for code blocks
  const codeBlockRegex =
    /<pre[^>]*>\s*<code[^>]*(?:class="[^"]*language-(\w+)[^"]*")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;

  let hasCodeBlocks = false;
  let match;

  while ((match = codeBlockRegex.exec(html)) !== null) {
    hasCodeBlocks = true;
    const language = match[1] || undefined;
    const codeContent = extractTextContent(match[2] || '');

    if (codeContent.trim()) {
      blocks.push({
        type: 'code',
        content: codeContent,
        language,
      });
    }
  }

  // Always include a text block with the main content
  // (code blocks are supplementary)
  if (textContent.trim()) {
    // If there are code blocks, remove code content from text
    let cleanText = textContent;
    if (hasCodeBlocks) {
      // Remove code block content from the text to avoid duplication
      for (const block of blocks) {
        if (block.type === 'code') {
          cleanText = cleanText.replace(block.content, '').trim();
        }
      }
    }

    if (cleanText.trim()) {
      // Insert text block at the beginning
      blocks.unshift({
        type: 'text',
        content: cleanText,
      });
    }
  }

  // Ensure at least one content block
  if (blocks.length === 0) {
    blocks.push({
      type: 'text',
      content: textContent || '',
    });
  }

  return blocks;
}

/**
 * Calculate total word count across all messages
 */
function calculateWordCount(messages: Message[]): number {
  let count = 0;

  for (const message of messages) {
    for (const block of message.content) {
      const words = block.content.trim().split(/\s+/);
      count += words.filter((w) => w.length > 0).length;
    }
  }

  return count;
}
