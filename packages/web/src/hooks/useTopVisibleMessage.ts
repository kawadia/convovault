import { useState, useEffect, useCallback } from 'react';

interface UseTopVisibleMessageOptions {
  /** Offset from top of viewport to check (accounts for sticky header) */
  topOffset?: number;
  /** Throttle delay in ms */
  throttleMs?: number;
}

/**
 * Hook that tracks which message role is currently at the top of the viewport.
 * Uses scroll events to find messages with data-role attribute.
 */
export function useTopVisibleMessage({
  topOffset = 150,
  throttleMs = 100,
}: UseTopVisibleMessageOptions = {}) {
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'assistant'>('assistant');

  const findTopMessage = useCallback(() => {
    const messages = document.querySelectorAll('[data-role]');
    let topMessageRole: 'user' | 'assistant' | null = null;
    let closestDistance = Infinity;

    messages.forEach((msg) => {
      const rect = msg.getBoundingClientRect();
      // Find the message whose top is closest to (but not above) the detection line
      const distance = rect.top - topOffset;

      // Message is visible and closest to the top detection line
      if (rect.bottom > topOffset && distance < closestDistance) {
        closestDistance = distance;
        const role = msg.getAttribute('data-role');
        if (role === 'user' || role === 'assistant') {
          topMessageRole = role;
        }
      }
    });

    if (topMessageRole) {
      setCurrentSpeaker(topMessageRole);
    }
  }, [topOffset]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (timeoutId) return;

      timeoutId = setTimeout(() => {
        findTopMessage();
        timeoutId = null;
      }, throttleMs);
    };

    // Initial check
    findTopMessage();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [findTopMessage, throttleMs]);

  return currentSpeaker;
}
