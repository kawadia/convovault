import { useAuth } from '../../contexts/AuthContext';

interface LoginPromptProps {
    onClose: () => void;
    title?: string;
    message?: string;
}

export default function LoginPrompt({ onClose, title = 'Sign in required', message = 'Please sign in to use this feature.' }: LoginPromptProps) {
    const { login } = useAuth();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-bg-secondary border border-border rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-text-primary mb-2">
                        {title}
                    </h2>
                    <p className="text-text-secondary mb-8 leading-relaxed">
                        {message}
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={login}
                            className="w-full px-6 py-3 bg-bg-secondary text-text-primary border border-border rounded-xl hover:bg-bg-tertiary transition-all flex items-center justify-center gap-3 font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Sign in with Google
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full px-6 py-3 bg-bg-tertiary text-text-primary rounded-xl hover:bg-bg-hover transition-colors font-medium border border-border"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
