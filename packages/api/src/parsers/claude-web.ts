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
 */
function extractMessages(html: string): Message[] {
  const messages: Message[] = [];

  // Find all message blocks with data-test-render-count="2"
  const blockRegex =
    /<div\s+data-test-render-count="2"[^>]*>([\s\S]*?)(?=<div\s+data-test-render-count="2"|<\/body>|$)/gi;

  let match;
  let index = 0;

  while ((match = blockRegex.exec(html)) !== null) {
    const blockContent = match[1];
    if (!blockContent) continue;

    // Determine role based on presence of font-user-message class
    const isUser = blockContent.includes('font-user-message');
    const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

    // Extract text content
    const textContent = extractTextContent(blockContent);

    // Skip empty blocks
    if (!textContent.trim()) continue;

    // Extract code blocks
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
