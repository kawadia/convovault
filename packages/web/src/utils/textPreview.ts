const PREVIEW_CHAR_LIMIT = 300;

/**
 * Extract preview text for collapsed messages.
 * Returns the first 300 characters, breaking at word boundary.
 */
export function getPreviewText(content: string): string {
  if (!content) return '';

  // If content is shorter than limit, return all
  if (content.length <= PREVIEW_CHAR_LIMIT) {
    return content;
  }

  // Find last space before limit to break at word boundary
  const lastSpace = content.lastIndexOf(' ', PREVIEW_CHAR_LIMIT);

  // If we found a reasonable break point, use it
  if (lastSpace > 100) {
    return content.substring(0, lastSpace);
  }

  // Fallback: just use the limit
  return content.substring(0, PREVIEW_CHAR_LIMIT);
}
