interface DeleteConfirmModalProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
  error?: string | null;
}

export default function DeleteConfirmModal({
  title,
  onConfirm,
  onCancel,
  isDeleting = false,
  error = null,
}: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-bg-secondary border border-border rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Delete chat?
          </h2>
          <p className="text-text-secondary mb-2 leading-relaxed">
            Are you sure you want to delete
          </p>
          <p className="text-text-primary font-medium mb-6 truncate px-4">
            "{title}"
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="w-full px-6 py-3 bg-bg-tertiary text-text-primary rounded-xl hover:bg-bg-hover transition-colors font-medium border border-border disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
