import { useState, useRef, useEffect } from 'react';

interface FilterDropdownProps {
  activeFilters: Set<string>;
  onToggleFilter: (filter: string) => void;
  onClear: () => void;
}

const FILTERS = ['Favorites', 'Bookmarked'];

export default function FilterDropdown({
  activeFilters,
  onToggleFilter,
  onClear,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeCount = activeFilters.size;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
          activeCount > 0
            ? 'bg-accent/10 border-accent text-accent'
            : 'bg-bg-tertiary border-border text-text-secondary hover:bg-bg-hover'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent text-white rounded-full">
            {activeCount}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 bg-bg-secondary border border-border rounded-lg shadow-xl py-2 z-50">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => onToggleFilter(filter)}
              className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-between"
            >
              <span>{filter}</span>
              {activeFilters.has(filter) && (
                <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
          {activeCount > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-text-muted hover:text-accent transition-colors"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
