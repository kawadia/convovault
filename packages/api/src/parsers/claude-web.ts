import type {
  ChatParser,
  ChatTranscript,
  Message,
  ContentBlock,
  Participants,
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
    const participants = extractParticipants(html);

    return {
      id: generateId(url),
      source: 'claude-web',
      sourceUrl: url,
      title,
      fetchedAt,
      messageCount: messages.length,
      wordCount,
      messages,
      participants,
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
 * Extract participant names from the intro text
 * Looks for patterns like "This is a copy of a chat between Claude and Shreyas"
 */
function extractParticipants(html: string): Participants | undefined {
  // Pattern: "This is a copy of a chat between X and Y"
  // X is typically the assistant (Claude), Y is the user
  const patterns = [
    // Standard format: "between Claude and Shreyas"
    /This is a copy of a chat between\s+(\w+)\s+and\s+(\w+)/i,
    // Alternative: could be in different order
    /chat between\s+(\w+)\s+and\s+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const [, name1, name2] = match;
      // Claude/Assistant is typically first, user is second
      // But let's be smart: if one of the names is "Claude", that's the assistant
      if (name1.toLowerCase() === 'claude') {
        return { assistant: name1, user: name2 };
      } else if (name2.toLowerCase() === 'claude') {
        return { assistant: name2, user: name1 };
      }
      // Default: first is assistant, second is user
      return { assistant: name1, user: name2 };
    }
  }

  return undefined;
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

  // Find assistant messages (data-is-streaming attribute with group relative pb-* class)
  // The HTML can have attributes in either order:
  //   <div data-is-streaming="false" class="group relative pb-8">
  //   <div class="group relative pb-3" data-is-streaming="false">
  // Note: "relative" may appear twice in the class (e.g., "group relative relative pb-8")
  const assistantMsgRegex = /<div[^>]*data-is-streaming="false"[^>]*class="group relative\s+(?:relative\s+)?pb-\d+"[^>]*>([\s\S]*?)(?=<div[^>]*data-is-streaming|<div[^>]*class="[^"]*font-user-message|$)/gi;
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

  // Also try the reverse attribute order (class before data-is-streaming)
  const assistantMsgRegex2 = /<div[^>]*class="group relative\s+(?:relative\s+)?pb-\d+"[^>]*data-is-streaming="false"[^>]*>([\s\S]*?)(?=<div[^>]*data-is-streaming|<div[^>]*class="[^"]*font-user-message|$)/gi;

  while ((match = assistantMsgRegex2.exec(html)) !== null) {
    const blockHtml = match[1] || '';
    const content = extractTextContent(blockHtml);
    if (content.trim() && content.length > 10) {
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
 * Extract text content from HTML, converting structure to markdown
 */
function extractTextContent(html: string): string {
  // Remove script and style tags completely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Convert block elements to preserve structure

  // Headers
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const lines = content.split('\n').map((line: string) => `> ${line}`).join('\n');
    return `\n\n${lines}\n\n`;
  });

  // Paragraphs and divs - add line breaks
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Lists - handle before removing other tags
  // First, process list items with proper markers
  text = processLists(text);

  // Inline formatting
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Links - extract text and URL
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Remove remaining HTML tags
  // Note: Simple /<[^>]+>/g fails when attributes contain '>' (e.g., Tailwind's [&_pre>div])
  // Use a more robust approach that handles quoted attributes
  text = removeHtmlTags(text);

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up excessive whitespace while preserving intentional line breaks
  text = text.replace(/[ \t]+/g, ' '); // Collapse horizontal whitespace
  text = text.replace(/\n[ \t]+/g, '\n'); // Remove leading whitespace on lines
  text = text.replace(/[ \t]+\n/g, '\n'); // Remove trailing whitespace on lines
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  text = text.trim();

  return text;
}

/**
 * Process HTML lists into markdown format
 */
function processLists(html: string): string {
  let text = html;

  // Process unordered lists
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    const items = extractListItems(content);
    return '\n\n' + items.map(item => `- ${item}`).join('\n') + '\n\n';
  });

  // Process ordered lists
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    const items = extractListItems(content);
    return '\n\n' + items.map((item, i) => `${i + 1}. ${item}`).join('\n') + '\n\n';
  });

  return text;
}

/**
 * Extract list items from list content
 */
function extractListItems(listHtml: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = liRegex.exec(listHtml)) !== null) {
    // Recursively process nested content (but strip inner list tags for now)
    let content = match[1] || '';
    // Remove nested ul/ol for now to avoid double processing
    content = content.replace(/<[uo]l[^>]*>[\s\S]*?<\/[uo]l>/gi, '');
    // Strip remaining tags
    content = content.replace(/<[^>]+>/g, '').trim();
    content = decodeHtmlEntities(content);
    if (content) {
      items.push(content);
    }
  }

  return items;
}

/**
 * Remove HTML tags, handling '>' inside quoted attributes
 * e.g., <div class="[&_pre>div]:bg-red"> should be fully removed
 */
function removeHtmlTags(html: string): string {
  let result = '';
  let i = 0;

  while (i < html.length) {
    if (html[i] === '<') {
      // Find the end of this tag, respecting quoted attributes
      let j = i + 1;
      let inQuote: string | null = null;

      while (j < html.length) {
        const char = html[j];

        if (inQuote) {
          // Inside a quoted attribute value
          if (char === inQuote) {
            inQuote = null;
          }
        } else {
          // Not inside quotes
          if (char === '"' || char === "'") {
            inQuote = char;
          } else if (char === '>') {
            // Found the end of the tag
            break;
          }
        }
        j++;
      }

      // Skip past the closing '>'
      i = j + 1;
    } else {
      result += html[i];
      i++;
    }
  }

  return result;
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
