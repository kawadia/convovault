import { useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search messages...',
  autoFocus = false,
  className = '',
  onFocus,
  onBlur,
  showCloseButton = false,
  onClose,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    onChange('');
    inputRef.current?.blur();
    onClose?.();
  };

  return (
    <div className={`relative transition-all duration-200 ease-out ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-10 py-2.5 border border-border rounded-xl bg-bg-tertiary text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none text-sm"
      />
      {/* Show close button when expanded, or clear button when has value */}
      {(showCloseButton || value) && (
        <button
          onClick={showCloseButton ? handleClose : () => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          type="button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
