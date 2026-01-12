import { describe, it, expect } from 'vitest';
import {
  ChatSourceSchema,
  ContentBlockSchema,
  MessageSchema,
  ChatTranscriptSchema,
  UserChatDataSchema,
  UserSettingsSchema,
  ImportChatRequestSchema,
  UpdateUserChatRequestSchema,
} from '../types';

describe('ChatSourceSchema', () => {
  it('accepts valid chat sources', () => {
    expect(ChatSourceSchema.parse('claude-web')).toBe('claude-web');
    expect(ChatSourceSchema.parse('claude-code')).toBe('claude-code');
    expect(ChatSourceSchema.parse('chatgpt')).toBe('chatgpt');
    expect(ChatSourceSchema.parse('generic')).toBe('generic');
  });

  it('rejects invalid chat sources', () => {
    expect(() => ChatSourceSchema.parse('invalid')).toThrow();
    expect(() => ChatSourceSchema.parse('')).toThrow();
    expect(() => ChatSourceSchema.parse(123)).toThrow();
  });
});

describe('ContentBlockSchema', () => {
  it('accepts valid text content block', () => {
    const result = ContentBlockSchema.parse({
      type: 'text',
      content: 'Hello world',
    });
    expect(result.type).toBe('text');
    expect(result.content).toBe('Hello world');
  });

  it('accepts valid code content block with language', () => {
    const result = ContentBlockSchema.parse({
      type: 'code',
      content: 'const x = 1;',
      language: 'typescript',
    });
    expect(result.type).toBe('code');
    expect(result.language).toBe('typescript');
  });

  it('accepts content block with metadata', () => {
    const result = ContentBlockSchema.parse({
      type: 'artifact',
      content: '<html></html>',
      title: 'My Artifact',
      metadata: { version: 1 },
    });
    expect(result.title).toBe('My Artifact');
    expect(result.metadata).toEqual({ version: 1 });
  });

  it('rejects content block without required fields', () => {
    expect(() => ContentBlockSchema.parse({})).toThrow();
    expect(() => ContentBlockSchema.parse({ type: 'text' })).toThrow();
    expect(() => ContentBlockSchema.parse({ content: 'test' })).toThrow();
  });

  it('rejects invalid content block type', () => {
    expect(() =>
      ContentBlockSchema.parse({ type: 'invalid', content: 'test' })
    ).toThrow();
  });
});

describe('MessageSchema', () => {
  it('accepts valid user message', () => {
    const result = MessageSchema.parse({
      id: 'msg-1',
      index: 0,
      role: 'user',
      content: [{ type: 'text', content: 'Hello' }],
    });
    expect(result.id).toBe('msg-1');
    expect(result.role).toBe('user');
    expect(result.content).toHaveLength(1);
  });

  it('accepts valid assistant message with timestamp', () => {
    const result = MessageSchema.parse({
      id: 'msg-2',
      index: 1,
      role: 'assistant',
      content: [{ type: 'text', content: 'Hi there!' }],
      timestamp: 1704067200000,
    });
    expect(result.timestamp).toBe(1704067200000);
  });

  it('accepts message with multiple content blocks', () => {
    const result = MessageSchema.parse({
      id: 'msg-3',
      index: 2,
      role: 'assistant',
      content: [
        { type: 'text', content: 'Here is some code:' },
        { type: 'code', content: 'console.log("hi")', language: 'javascript' },
      ],
    });
    expect(result.content).toHaveLength(2);
  });

  it('rejects message with invalid role', () => {
    expect(() =>
      MessageSchema.parse({
        id: 'msg-1',
        index: 0,
        role: 'invalid',
        content: [],
      })
    ).toThrow();
  });

  it('rejects message with negative index', () => {
    expect(() =>
      MessageSchema.parse({
        id: 'msg-1',
        index: -1,
        role: 'user',
        content: [],
      })
    ).toThrow();
  });
});

describe('ChatTranscriptSchema', () => {
  const validTranscript = {
    id: 'chat-123',
    source: 'claude-web',
    sourceUrl: 'https://claude.ai/share/abc123',
    title: 'Test Chat',
    fetchedAt: 1704067200000,
    messageCount: 2,
    wordCount: 100,
    messages: [
      {
        id: 'msg-1',
        index: 0,
        role: 'user',
        content: [{ type: 'text', content: 'Hello' }],
      },
      {
        id: 'msg-2',
        index: 1,
        role: 'assistant',
        content: [{ type: 'text', content: 'Hi!' }],
      },
    ],
  };

  it('accepts valid chat transcript', () => {
    const result = ChatTranscriptSchema.parse(validTranscript);
    expect(result.id).toBe('chat-123');
    expect(result.source).toBe('claude-web');
    expect(result.messages).toHaveLength(2);
  });

  it('accepts transcript with optional createdAt', () => {
    const result = ChatTranscriptSchema.parse({
      ...validTranscript,
      createdAt: 1704067000000,
    });
    expect(result.createdAt).toBe(1704067000000);
  });

  it('rejects transcript with invalid URL', () => {
    expect(() =>
      ChatTranscriptSchema.parse({
        ...validTranscript,
        sourceUrl: 'not-a-url',
      })
    ).toThrow();
  });

  it('rejects transcript with negative message count', () => {
    expect(() =>
      ChatTranscriptSchema.parse({
        ...validTranscript,
        messageCount: -1,
      })
    ).toThrow();
  });
});

describe('UserChatDataSchema', () => {
  it('accepts valid user chat data', () => {
    const result = UserChatDataSchema.parse({
      chatId: 'chat-123',
      readPosition: 5,
      isRead: true,
      importedAt: 1704067200000,
      tags: ['important', 'work'],
    });
    expect(result.chatId).toBe('chat-123');
    expect(result.tags).toEqual(['important', 'work']);
  });

  it('accepts user chat data with optional folder', () => {
    const result = UserChatDataSchema.parse({
      chatId: 'chat-123',
      readPosition: 0,
      isRead: false,
      folder: 'work',
      importedAt: 1704067200000,
      tags: [],
    });
    expect(result.folder).toBe('work');
  });

  it('rejects negative read position', () => {
    expect(() =>
      UserChatDataSchema.parse({
        chatId: 'chat-123',
        readPosition: -1,
        isRead: false,
        importedAt: 1704067200000,
        tags: [],
      })
    ).toThrow();
  });
});

describe('UserSettingsSchema', () => {
  it('accepts valid settings', () => {
    const result = UserSettingsSchema.parse({
      theme: 'dark',
      fontSize: 'medium',
    });
    expect(result.theme).toBe('dark');
    expect(result.fontSize).toBe('medium');
  });

  it('accepts settings with optional defaultFolder', () => {
    const result = UserSettingsSchema.parse({
      theme: 'system',
      fontSize: 'large',
      defaultFolder: 'inbox',
    });
    expect(result.defaultFolder).toBe('inbox');
  });

  it('rejects invalid theme', () => {
    expect(() =>
      UserSettingsSchema.parse({
        theme: 'invalid',
        fontSize: 'medium',
      })
    ).toThrow();
  });

  it('rejects invalid fontSize', () => {
    expect(() =>
      UserSettingsSchema.parse({
        theme: 'light',
        fontSize: 'invalid',
      })
    ).toThrow();
  });
});

describe('ImportChatRequestSchema', () => {
  it('accepts valid import request', () => {
    const result = ImportChatRequestSchema.parse({
      url: 'https://claude.ai/share/abc123',
    });
    expect(result.url).toBe('https://claude.ai/share/abc123');
  });

  it('rejects invalid URL', () => {
    expect(() => ImportChatRequestSchema.parse({ url: 'not-a-url' })).toThrow();
  });

  it('rejects missing URL', () => {
    expect(() => ImportChatRequestSchema.parse({})).toThrow();
  });
});

describe('UpdateUserChatRequestSchema', () => {
  it('accepts update with readPosition', () => {
    const result = UpdateUserChatRequestSchema.parse({
      readPosition: 10,
    });
    expect(result.readPosition).toBe(10);
  });

  it('accepts update with isRead', () => {
    const result = UpdateUserChatRequestSchema.parse({
      isRead: true,
    });
    expect(result.isRead).toBe(true);
  });

  it('accepts update with folder (including null to clear)', () => {
    const result1 = UpdateUserChatRequestSchema.parse({ folder: 'work' });
    expect(result1.folder).toBe('work');

    const result2 = UpdateUserChatRequestSchema.parse({ folder: null });
    expect(result2.folder).toBeNull();
  });

  it('accepts empty update', () => {
    const result = UpdateUserChatRequestSchema.parse({});
    expect(result).toEqual({});
  });
});

