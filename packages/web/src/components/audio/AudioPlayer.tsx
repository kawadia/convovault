import { useRef, useState, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  chatId: string;
  audioUrl: string;
  duration: number;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ chatId, audioUrl, duration, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Restore position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`audio-position-${chatId}`);
    if (saved && audioRef.current) {
      audioRef.current.currentTime = parseFloat(saved);
      setCurrentTime(parseFloat(saved));
    }
  }, [chatId]);

  // Save position periodically
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        localStorage.setItem(
          `audio-position-${chatId}`,
          audioRef.current.currentTime.toString()
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [chatId, isPlaying]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    localStorage.removeItem(`audio-position-${chatId}`);
  }, [chatId]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      localStorage.setItem(
        `audio-position-${chatId}`,
        audioRef.current.currentTime.toString()
      );
    }
    onClose?.();
  }, [chatId, onClose]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border p-4 z-30">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onCanPlay={handleCanPlay}
        preload="auto"
      />

      <div className="max-w-3xl mx-auto flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="p-3 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-bg-tertiary accent-accent"
          />
        </div>

        {/* Time display */}
        <span className="text-sm text-text-muted tabular-nums min-w-[80px] text-right">
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </span>

        {/* Close button */}
        {onClose && (
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Close player"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default AudioPlayer;
