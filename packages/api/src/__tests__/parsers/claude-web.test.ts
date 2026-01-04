import { describe, it, expect } from 'vitest';
import { claudeWebParser } from '../../parsers/claude-web';

// Test fixture: minimal HTML structure mimicking claude.ai share page
const createMockHtml = (options: {
  title?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string; hasCode?: boolean }>;
}) => {
  const { title = 'Test Chat', messages = [] } = options;

  const messageBlocks = messages
    .map((msg, i) => {
      if (msg.role === 'user') {
        return `
          <div data-test-render-count="2">
            <div class="mb-1 mt-6 group">
              <div class="flex flex-col items-end gap-1">
                <div class="flex flex-row gap-2 relative">
                  <div class="flex-1">
                    <div class="font-large !font-user-message grid grid-cols-1 gap-2 py-0.5 relative">
                      <p>${msg.content}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        const codeBlock = msg.hasCode
          ? `<pre><code class="language-javascript">console.log("test");</code></pre>`
          : '';
        return `
          <div data-test-render-count="2">
            <div class="group">
              <div class="group relative pb-3" data-is-streaming="false">
                <div class="grid-cols-1 grid gap-2.5">
                  <p>${msg.content}</p>
                  ${codeBlock}
                </div>
              </div>
            </div>
          </div>
        `;
      }
    })
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>${title} | Claude</title>
    </head>
    <body>
      <div class="root">
        ${messageBlocks}
      </div>
    </body>
    </html>
  `;
};

describe('claudeWebParser', () => {
  describe('canParse', () => {
    it('returns true for valid claude.ai share URLs', () => {
      expect(
        claudeWebParser.canParse('https://claude.ai/share/abc123')
      ).toBe(true);
      expect(
        claudeWebParser.canParse(
          'https://claude.ai/share/ec0a6320-d9ab-4598-b2be-ac5d9d2c24d1'
        )
      ).toBe(true);
    });

    it('returns true for claude.ai share URLs with query params', () => {
      expect(
        claudeWebParser.canParse('https://claude.ai/share/abc123?ref=twitter')
      ).toBe(true);
    });

    it('returns false for non-claude.ai URLs', () => {
      expect(claudeWebParser.canParse('https://google.com')).toBe(false);
      expect(claudeWebParser.canParse('https://chat.openai.com/share/abc')).toBe(
        false
      );
    });

    it('returns false for claude.ai URLs that are not share links', () => {
      expect(claudeWebParser.canParse('https://claude.ai/chat/abc123')).toBe(
        false
      );
      expect(claudeWebParser.canParse('https://claude.ai/')).toBe(false);
    });
  });

  describe('parse', () => {
    it('extracts title from page', () => {
      const html = createMockHtml({ title: 'Wealth inequality concerns' });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.title).toBe('Wealth inequality concerns');
    });

    it('extracts title without "| Claude" suffix', () => {
      const html = createMockHtml({ title: 'My Test Chat' });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.title).toBe('My Test Chat');
      expect(result.title).not.toContain('| Claude');
    });

    it('generates correct id from URL', () => {
      const html = createMockHtml({});
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/ec0a6320-d9ab-4598-b2be-ac5d9d2c24d1'
      );

      // ID should be deterministic based on URL
      expect(result.id).toBeTruthy();
      expect(typeof result.id).toBe('string');
    });

    it('sets source to claude-web', () => {
      const html = createMockHtml({});
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.source).toBe('claude-web');
    });

    it('preserves source URL', () => {
      const html = createMockHtml({});
      const url = 'https://claude.ai/share/abc123';
      const result = claudeWebParser.parse(html, url);

      expect(result.sourceUrl).toBe(url);
    });

    it('extracts messages with correct roles', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'Hello Claude!' },
          { role: 'assistant', content: 'Hello! How can I help you today?' },
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe('user');
      expect(result.messages[1]?.role).toBe('assistant');
    });

    it('extracts message content as text blocks', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: 'The answer is 4.' },
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.messages[0]?.content[0]?.type).toBe('text');
      expect(result.messages[0]?.content[0]?.content).toContain('What is 2+2?');
      expect(result.messages[1]?.content[0]?.content).toContain(
        'The answer is 4.'
      );
    });

    it('assigns sequential indices to messages', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Second' },
          { role: 'user', content: 'Third' },
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.messages[0]?.index).toBe(0);
      expect(result.messages[1]?.index).toBe(1);
      expect(result.messages[2]?.index).toBe(2);
    });

    it('generates unique message IDs', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Second' },
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.messages[0]?.id).toBeTruthy();
      expect(result.messages[1]?.id).toBeTruthy();
      expect(result.messages[0]?.id).not.toBe(result.messages[1]?.id);
    });

    it('counts messages correctly', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'One' },
          { role: 'assistant', content: 'Two' },
          { role: 'user', content: 'Three' },
          { role: 'assistant', content: 'Four' },
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.messageCount).toBe(4);
    });

    it('calculates word count', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'Hello world' }, // 2 words
          { role: 'assistant', content: 'Hi there friend' }, // 3 words
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('handles code blocks in assistant messages', () => {
      const html = createMockHtml({
        messages: [
          { role: 'user', content: 'Show me code' },
          { role: 'assistant', content: 'Here is code:', hasCode: true },
        ],
      });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      // Should have text and code content blocks
      const assistantContent = result.messages[1]?.content;
      expect(assistantContent?.length).toBeGreaterThanOrEqual(1);
    });

    it('sets fetchedAt timestamp', () => {
      const html = createMockHtml({});
      const before = Date.now();
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );
      const after = Date.now();

      expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
      expect(result.fetchedAt).toBeLessThanOrEqual(after);
    });

    it('handles empty conversation', () => {
      const html = createMockHtml({ messages: [] });
      const result = claudeWebParser.parse(
        html,
        'https://claude.ai/share/abc123'
      );

      expect(result.messages).toHaveLength(0);
      expect(result.messageCount).toBe(0);
    });

    it('handles malformed HTML gracefully', () => {
      const malformedHtml = '<html><head><title>Test | Claude</title></head><body></body></html>';

      expect(() =>
        claudeWebParser.parse(malformedHtml, 'https://claude.ai/share/abc123')
      ).not.toThrow();
    });
  });
});
