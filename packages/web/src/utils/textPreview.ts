const PREVIEW_CHAR_LIMIT = 250;
const MIN_VISIBLE_CHARS = 150; // Roughly 2-3 lines

/**
 * Extract preview text for collapsed messages.
 * Returns first paragraph or ~250 chars, whichever is shorter.
 * Breaks at word boundary to avoid cutting mid-word.
 */
export function getPreviewText(content: string): string {
  if (!content) return '';

  // Find first paragraph boundary (double newline)
  const firstParagraphEnd = content.indexOf('\n\n');

  // If first paragraph is within limit, use it
  if (firstParagraphEnd > 0 && firstParagraphEnd <= PREVIEW_CHAR_LIMIT) {
    return content.substring(0, firstParagraphEnd);
  }

  // If content is shorter than limit, return all
  if (content.length <= PREVIEW_CHAR_LIMIT) {
    return content;
  }

  // Find last space before limit to break at word boundary
  const lastSpace = content.lastIndexOf(' ', PREVIEW_CHAR_LIMIT);

  // If we found a reasonable break point, use it
  if (lastSpace > MIN_VISIBLE_CHARS) {
    return content.substring(0, lastSpace);
  }

  // Fallback: just use the limit
  return content.substring(0, PREVIEW_CHAR_LIMIT);
}
