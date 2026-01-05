import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, setAdminKey, isAdmin } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [url, setUrl] = useState('');
  const [adminKey, setAdminKeyInput] = useState('');
  const [showAdminKey] = useState(!isAdmin());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (chatUrl: string) => {
      if (adminKey) {
        setAdminKey(adminKey);
      }
      return api.importChat(chatUrl);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      navigate(`/chat/${data.id}`);
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      importMutation.mutate(url.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Chat
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showAdminKey && (
            <div>
              <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Admin Key
              </label>
              <input
                type="password"
                id="adminKey"
                value={adminKey}
                onChange={(e) => setAdminKeyInput(e.target.value)}
                placeholder="Enter admin key..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Chat URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://claude.ai/share/..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Paste a claude.ai share link
            </p>
          </div>

          {importMutation.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {importMutation.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importMutation.isPending}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {importMutation.isPending ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
