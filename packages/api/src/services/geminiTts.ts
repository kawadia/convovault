import type { ChatTranscript, VoicePreset, Message } from '@convovault/shared';

// Voice mapping for presets -> Gemini voice IDs
// See: https://ai.google.dev/gemini-api/docs/speech-generation
const VOICE_PRESETS: Record<VoicePreset, string> = {
  'male-casual': 'Charon',
  'male-formal': 'Fenrir',
  'female-casual': 'Kore',
  'female-formal': 'Aoede',
};

interface VoiceConfig {
  userVoice: VoicePreset;
  assistantVoice: VoicePreset;
}

interface GeminiTTSResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        inlineData?: {
          mimeType: string;
          data: string; // base64 encoded audio
        };
      }>;
    };
  }>;
}

/**
 * Extracts plain text content from a message, filtering out code blocks
 */
function extractTextContent(message: Message): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => {
      // Clean up the text for TTS
      return block.content
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`[^`]+`/g, '') // Remove inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links -> text only
        .replace(/\n{3,}/g, '\n\n') // Normalize whitespace
        .trim();
    })
    .filter((text) => text.length > 0)
    .join(' ');
}

/**
 * Formats a chat transcript for Gemini TTS multi-speaker dialogue
 */
function formatForGeminiTTS(transcript: ChatTranscript): string {
  return transcript.messages
    .map((msg) => {
      const speaker = msg.role === 'user' ? 'User' : 'Claude';
      const text = extractTextContent(msg);
      if (!text) return null;
      return `${speaker}: ${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Generates dialogue audio using Gemini TTS API
 */
export async function generateDialogueAudio(
  transcript: ChatTranscript,
  voiceConfig: VoiceConfig,
  apiKey: string
): Promise<{ audioData: ArrayBuffer; mimeType: string }> {
  const dialogueText = formatForGeminiTTS(transcript);

  if (!dialogueText) {
    throw new Error('No text content to generate audio from');
  }

  // Check if text exceeds Gemini's limit
  const textBytes = new TextEncoder().encode(dialogueText).length;
  if (textBytes > 4000) {
    console.warn(
      `Text exceeds 4000 byte limit (${textBytes} bytes). Will be truncated.`
    );
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: dialogueText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'User',
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: VOICE_PRESETS[voiceConfig.userVoice],
                    },
                  },
                },
                {
                  speaker: 'Claude',
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: VOICE_PRESETS[voiceConfig.assistantVoice],
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini TTS API error:', errorText);
    throw new Error(`Gemini TTS API error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as GeminiTTSResponse;

  // Extract audio data from response
  const audioPart = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioPart) {
    throw new Error('No audio data in Gemini TTS response');
  }

  // Decode base64 audio
  const binaryString = atob(audioPart.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    audioData: bytes.buffer,
    mimeType: audioPart.mimeType || 'audio/wav',
  };
}

/**
 * Chunks a transcript for processing if it exceeds the byte limit
 */
export function chunkTranscriptForTTS(
  transcript: ChatTranscript,
  maxBytes = 3500
): ChatTranscript[] {
  const chunks: ChatTranscript[] = [];
  let currentMessages: Message[] = [];
  let currentSize = 0;

  for (const msg of transcript.messages) {
    const msgText = extractTextContent(msg);
    const msgSize = new TextEncoder().encode(msgText).length;

    // If single message exceeds limit, it becomes its own chunk
    if (msgSize > maxBytes) {
      // Flush current chunk first
      if (currentMessages.length > 0) {
        chunks.push({ ...transcript, messages: currentMessages });
      }
      // Add oversized message as its own chunk (will be truncated by API)
      chunks.push({ ...transcript, messages: [msg] });
      currentMessages = [];
      currentSize = 0;
      continue;
    }

    // Check if adding this message would exceed limit
    if (currentSize + msgSize + 2 > maxBytes && currentMessages.length > 0) {
      // Flush current chunk
      chunks.push({ ...transcript, messages: currentMessages });
      currentMessages = [msg];
      currentSize = msgSize;
    } else {
      currentMessages.push(msg);
      currentSize += msgSize + 2; // +2 for separator
    }
  }

  // Flush remaining
  if (currentMessages.length > 0) {
    chunks.push({ ...transcript, messages: currentMessages });
  }

  return chunks;
}

/**
 * Estimates the duration of audio based on word count
 * Average speaking rate is ~150 words per minute
 */
export function estimateDuration(transcript: ChatTranscript): number {
  const text = formatForGeminiTTS(transcript);
  const wordCount = text.split(/\s+/).length;
  return Math.ceil((wordCount / 150) * 60); // seconds
}
