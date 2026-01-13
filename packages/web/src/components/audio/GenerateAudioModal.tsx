import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { VoicePreset, AudioResponse } from '@convovault/shared';
import { api } from '../../api/client';
import VoiceSelector, { type VoiceOption } from './VoiceSelector';

interface GenerateAudioModalProps {
  chatId: string;
  chatTitle: string;
  onClose: () => void;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'male-casual', label: 'Male (Casual)', description: 'Relaxed, conversational' },
  { id: 'male-formal', label: 'Male (Formal)', description: 'Professional, clear' },
  { id: 'female-casual', label: 'Female (Casual)', description: 'Friendly, warm' },
  { id: 'female-formal', label: 'Female (Formal)', description: 'Professional, articulate' },
];

export function GenerateAudioModal({ chatId, chatTitle, onClose }: GenerateAudioModalProps) {
  const [userVoice, setUserVoice] = useState<VoicePreset>('male-casual');
  const [assistantVoice, setAssistantVoice] = useState<VoicePreset>('female-formal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Start generation
      const result = await api.generateAudio(chatId, { userVoice, assistantVoice });

      if (result.status === 'ready') {
        // Generation completed immediately
        setProgress(100);
        setSuccess(true);
        queryClient.invalidateQueries({ queryKey: ['audioStatus', chatId] });
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        return;
      }

      if (result.status === 'failed') {
        setError(result.error || 'Generation failed');
        setIsGenerating(false);
        return;
      }

      // Poll for progress
      let pollCount = 0;
      pollIntervalRef.current = setInterval(async () => {
        pollCount++;
        try {
          const status: AudioResponse = await api.getAudioStatus(chatId);

          if (status.status === 'ready') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setProgress(100);
            setSuccess(true);
            setIsGenerating(false);
            queryClient.invalidateQueries({ queryKey: ['audioStatus', chatId] });
            queryClient.invalidateQueries({ queryKey: ['chats'] });
          } else if (status.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setError(status.error || 'Generation failed');
            setIsGenerating(false);
          } else if (status.status === 'generating') {
            // Simulate progress since we don't have real progress from API
            setProgress(Math.min(90, pollCount * 10));
          }

          // Timeout after 2 minutes
          if (pollCount > 60) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setError('Generation timed out. Please try again.');
            setIsGenerating(false);
          }
        } catch {
          // Continue polling on error
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setIsGenerating(false);
    }
  }, [chatId, userVoice, assistantVoice, queryClient]);

  const handleClose = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-lg shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Generate Audio</h2>
          <button
            onClick={handleClose}
            disabled={isGenerating && !success}
            className="text-text-muted hover:text-text-secondary disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat title */}
        <p className="text-sm text-text-muted mb-6 truncate">
          {chatTitle}
        </p>

        {success ? (
          // Success state
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">Audio Generated!</h3>
            <p className="text-sm text-text-muted mb-6">
              Your audio is ready. You can now listen to it on the chat page.
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Voice selection */}
            <div className="space-y-6">
              <VoiceSelector
                label="Your Voice"
                options={VOICE_OPTIONS}
                value={userVoice}
                onChange={setUserVoice}
                disabled={isGenerating}
              />
              <VoiceSelector
                label="Claude's Voice"
                options={VOICE_OPTIONS}
                value={assistantVoice}
                onChange={setAssistantVoice}
                disabled={isGenerating}
              />
            </div>

            {/* Progress indicator */}
            {isGenerating && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-text-muted mb-2">
                  <span>Generating audio...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  This may take a minute for longer conversations.
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                disabled={isGenerating}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text-muted hover:bg-bg-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Audio'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GenerateAudioModal;
