import { z } from 'zod';

// ============================================================================
// Chat Source Types
// ============================================================================

export const ChatSourceSchema = z.enum([
  'claude-web',
  'claude-code',
  'chatgpt',
  'generic',
]);

export type ChatSource = z.infer<typeof ChatSourceSchema>;

// ============================================================================
// Content Block Types
// ============================================================================

export const ContentBlockTypeSchema = z.enum([
  'text',
  'code',
  'thinking',
  'artifact',
  'tool-use',
  'tool-result',
  'image',
]);

export type ContentBlockType = z.infer<typeof ContentBlockTypeSchema>;

export const ContentBlockSchema = z.object({
  type: ContentBlockTypeSchema,
  content: z.string(),
  language: z.string().optional(),
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

// ============================================================================
// Message Types
// ============================================================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  role: MessageRoleSchema,
  content: z.array(ContentBlockSchema),
  timestamp: z.number().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Chat Transcript Types
// ============================================================================

export const ParticipantsSchema = z.object({
  user: z.string(),
  assistant: z.string(),
});

export type Participants = z.infer<typeof ParticipantsSchema>;

export const ChatTranscriptSchema = z.object({
  id: z.string(),
  source: ChatSourceSchema,
  sourceUrl: z.string().url(),
  title: z.string(),
  createdAt: z.number().optional(),
  fetchedAt: z.number(),
  messageCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  messages: z.array(MessageSchema),
  participants: ParticipantsSchema.optional(),
});

export type ChatTranscript = z.infer<typeof ChatTranscriptSchema>;

// ============================================================================
// User Data Types
// ============================================================================

export const UserChatDataSchema = z.object({
  chatId: z.string(),
  readPosition: z.number().int().nonnegative(),
  isRead: z.boolean(),
  folder: z.string().optional(),
  importedAt: z.number(),
  tags: z.array(z.string()),
});

export type UserChatData = z.infer<typeof UserChatDataSchema>;

export const UserSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  fontSize: z.enum(['small', 'medium', 'large']),
  defaultFolder: z.string().optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

// ============================================================================
// API Types
// ============================================================================

export const ImportChatRequestSchema = z.object({
  url: z.string().url(),
});

export type ImportChatRequest = z.infer<typeof ImportChatRequestSchema>;

export const UpdateUserChatRequestSchema = z.object({
  readPosition: z.number().int().nonnegative().optional(),
  isRead: z.boolean().optional(),
  folder: z.string().nullable().optional(),
});

export type UpdateUserChatRequest = z.infer<typeof UpdateUserChatRequestSchema>;

// ============================================================================
// Parser Interface
// ============================================================================

export interface ChatParser {
  source: ChatSource;
  canParse(url: string): boolean;
  parse(html: string, url: string): ChatTranscript;
}

// ============================================================================
// Audio Types
// ============================================================================

export const VoicePresetSchema = z.enum([
  'male-casual',
  'male-formal',
  'female-casual',
  'female-formal',
]);

export type VoicePreset = z.infer<typeof VoicePresetSchema>;

export const VoiceConfigSchema = z.object({
  userVoice: VoicePresetSchema,
  assistantVoice: VoicePresetSchema,
});

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

export const AudioStatusSchema = z.enum([
  'pending',
  'generating',
  'ready',
  'failed',
]);

export type AudioStatus = z.infer<typeof AudioStatusSchema>;

export const AudioResponseSchema = z.object({
  chatId: z.string(),
  status: AudioStatusSchema,
  voiceConfig: VoiceConfigSchema.optional(),
  duration: z.number().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
  progress: z.number().optional(),
});

export type AudioResponse = z.infer<typeof AudioResponseSchema>;

export const GenerateAudioRequestSchema = z.object({
  userVoice: VoicePresetSchema,
  assistantVoice: VoicePresetSchema,
});

export type GenerateAudioRequest = z.infer<typeof GenerateAudioRequestSchema>;
