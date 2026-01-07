import { useEffect, useRef, useCallback } from 'react';

interface UseIntersectionCollapseOptions {
  isExpanded: boolean;
  onCollapse: () => void;
  enabled?: boolean;
}

/**
 * Hook that auto-collapses a message when it's scrolled out of view.
 * Used for the "Skim Mode" feature in Editorial Stream.
 */
export function useIntersectionCollapse({
  isExpanded,
  onCollapse,
  enabled = true,
}: UseIntersectionCollapseOptions) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasBeenVisibleRef = useRef(false);
  const collapseTimeoutRef = useRef<number | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      // Track if element has ever been visible (to avoid collapsing on initial render)
      if (entry.isIntersecting) {
        hasBeenVisibleRef.current = true;
        // Clear any pending collapse
        if (collapseTimeoutRef.current) {
          clearTimeout(collapseTimeoutRef.current);
          collapseTimeoutRef.current = null;
        }
      }

      // Only collapse if:
      // 1. Message is currently expanded
      // 2. Element is no longer intersecting (scrolled out of view)
      // 3. Element was previously visible (not initial render)
      // 4. Feature is enabled
      if (isExpanded && !entry.isIntersecting && hasBeenVisibleRef.current && enabled) {
        // Delay to prevent aggressive collapsing during fast scrolling
        collapseTimeoutRef.current = window.setTimeout(() => {
          // Re-check if element is still out of view before collapsing
          if (elementRef.current) {
            const rect = elementRef.current.getBoundingClientRect();
            const isStillOutOfView = rect.bottom < -50 || rect.top > window.innerHeight + 50;
            if (isStillOutOfView) {
              onCollapse();
            }
          }
        }, 500);
      }
    },
    [isExpanded, onCollapse, enabled]
  );

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: '50px', // Small buffer to avoid edge cases
      threshold: 0,
    });

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, [handleIntersection, enabled]);

  // Reset visibility tracking when collapsing
  useEffect(() => {
    if (!isExpanded) {
      hasBeenVisibleRef.current = false;
    }
  }, [isExpanded]);

  return elementRef;
}
