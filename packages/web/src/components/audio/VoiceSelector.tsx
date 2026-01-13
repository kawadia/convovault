import { useRef, useState, useCallback } from 'react';
import type { VoicePreset } from '@convovault/shared';

export interface VoiceOption {
  id: VoicePreset;
  label: string;
  description: string;
}

interface VoiceSelectorProps {
  label: string;
  options: VoiceOption[];
  value: VoicePreset;
  onChange: (value: VoicePreset) => void;
  onPreview?: (voiceId: VoicePreset) => void;
  disabled?: boolean;
}

export function VoiceSelector({
  label,
  options,
  value,
  onChange,
  onPreview,
  disabled,
}: VoiceSelectorProps) {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreview = useCallback(
    (voiceId: VoicePreset, e: React.MouseEvent) => {
      e.stopPropagation();

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // If clicking the same voice that's playing, just stop
      if (isPlaying === voiceId) {
        setIsPlaying(null);
        return;
      }

      // Call parent preview handler if provided
      if (onPreview) {
        onPreview(voiceId);
      }

      // Play sample audio
      const audio = new Audio(`/audio/samples/${voiceId}.mp3`);
      audio.onended = () => setIsPlaying(null);
      audio.onerror = () => setIsPlaying(null);
      audio.play().catch(() => setIsPlaying(null));

      audioRef.current = audio;
      setIsPlaying(voiceId);
    },
    [isPlaying, onPreview]
  );

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">
        {label}
      </label>
      <div className="space-y-2">
        {options.map((option) => (
          <div
            key={option.id}
            onClick={() => !disabled && onChange(option.id)}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              value === option.id
                ? 'border-accent bg-accent/10'
                : 'border-border hover:bg-bg-hover'
            } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {/* Radio indicator */}
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                value === option.id ? 'border-accent' : 'border-text-muted'
              }`}
            >
              {value === option.id && (
                <div className="w-2 h-2 rounded-full bg-accent" />
              )}
            </div>

            {/* Voice info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-primary">{option.label}</div>
              <div className="text-sm text-text-muted">{option.description}</div>
            </div>

            {/* Preview button */}
            <button
              onClick={(e) => handlePreview(option.id, e)}
              disabled={disabled}
              className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0"
              title="Preview voice"
            >
              {isPlaying === option.id ? (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VoiceSelector;
