const PREVIEW_WORD_LIMIT = 250;

/**
 * Extract preview text for collapsed messages.
 * Returns the first 250 words of content.
 * Breaks at word boundary to avoid cutting mid-word.
 */
export function getPreviewText(content: string): string {
  if (!content) return '';

  // Split into words
  const words = content.split(/\s+/).filter(Boolean);

  // If content is shorter than limit, return all
  if (words.length <= PREVIEW_WORD_LIMIT) {
    return content;
  }

  // Take first 250 words and join them back
  const previewWords = words.slice(0, PREVIEW_WORD_LIMIT);
  return previewWords.join(' ');
}
