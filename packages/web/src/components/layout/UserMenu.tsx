import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function UserMenu() {
    const { user, logout } = useAuth();
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

    if (!user) return null;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center focus:outline-none"
            >
                <img
                    src={user.picture}
                    alt={user.name}
                    className={`w-8 h-8 rounded-full border transition-all cursor-pointer ${isOpen ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent'
                        }`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 z-50">
                    <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-medium text-text-primary truncate">
                            {user.name}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                            {user.email}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
}
