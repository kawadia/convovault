import type { Message } from '@convovault/shared';

const WORDS_PER_MINUTE = 200;

export interface MessageAnalytics {
  charCount: number;
  wordCount: number;
  paragraphCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  readTimeMinutes: number;
}

export function analyzeMessage(message: Message): MessageAnalytics {
  let charCount = 0;
  let wordCount = 0;
  let paragraphCount = 0;
  let codeBlockCount = 0;

  for (const block of message.content) {
    charCount += block.content.length;

    if (block.type === 'code') {
      codeBlockCount++;
    } else {
      // Count words (split on whitespace)
      const words = block.content.trim().split(/\s+/).filter(Boolean);
      wordCount += words.length;

      // Count paragraphs (double newlines or single blocks)
      const paragraphs = block.content.split(/\n\n+/).filter(p => p.trim());
      paragraphCount += paragraphs.length;
    }
  }

  return {
    charCount,
    wordCount,
    paragraphCount: Math.max(1, paragraphCount),
    hasCodeBlocks: codeBlockCount > 0,
    codeBlockCount,
    readTimeMinutes: Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)),
  };
}

export function getMetadataPillText(analytics: MessageAnalytics, isCollapsed: boolean): string {
  if (!isCollapsed) return 'Collapse';

  const parts: string[] = [];

  // Prioritize code blocks if present
  if (analytics.hasCodeBlocks) {
    parts.push(analytics.codeBlockCount === 1 ? 'Code Snippet' : `${analytics.codeBlockCount} Code Snippets`);
  }

  // Add paragraph count if > 1
  if (analytics.paragraphCount > 1) {
    parts.push(`${analytics.paragraphCount} paragraphs`);
  }

  // Add read time
  if (analytics.readTimeMinutes >= 1) {
    parts.push(`${analytics.readTimeMinutes} min read`);
  }

  if (parts.length === 0) return '+ Expand';

  return '+ ' + parts.join(' · ');
}
