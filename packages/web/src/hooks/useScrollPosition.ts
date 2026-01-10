import { useState, useEffect, useCallback } from 'react';

interface UseScrollPositionOptions {
  threshold?: number;
  enabled?: boolean;
}

interface ScrollState {
  scrollY: number;
  isScrolled: boolean;
}

/**
 * Hook that tracks scroll position and returns whether user has scrolled past threshold.
 * Used for morphing header behavior on mobile.
 */
export function useScrollPosition({
  threshold = 100,
  enabled = true,
}: UseScrollPositionOptions = {}): ScrollState {
  const [state, setState] = useState<ScrollState>({
    scrollY: 0,
    isScrolled: false,
  });

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    setState({
      scrollY: currentScrollY,
      isScrolled: currentScrollY > threshold,
    });
  }, [threshold]);

  useEffect(() => {
    if (!enabled) {
      setState({ scrollY: 0, isScrolled: false });
      return;
    }

    // Check initial scroll position
    handleScroll();

    // Use passive listener for better scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, enabled]);

  return state;
}
