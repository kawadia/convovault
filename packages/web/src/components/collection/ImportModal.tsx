import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAdminKey, isAdmin, api } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

type ImportStatus = 'idle' | 'importing' | 'done';

interface ImportResult {
  url: string;
  status: 'success' | 'duplicate' | 'error';
  title?: string;
  messageCount?: number;
  chatId?: string;
  error?: string;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [adminKey, setAdminKeyInput] = useState('');
  const [showAdminKey] = useState(!isAdmin());
  const [adminKeySet, setAdminKeySet] = useState(isAdmin());

  const [urlsInput, setUrlsInput] = useState('');
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const queryClient = useQueryClient();

  const handleSaveKey = () => {
    if (adminKey) {
      setAdminKey(adminKey);
      setAdminKeySet(true);
    }
  };

  // Parse URLs from input (one per line, filter valid claude.ai/share URLs)
  const parseUrls = (input: string): string[] => {
    return input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('claude.ai/share/'));
  };

  const handleImport = useCallback(async () => {
    const urls = parseUrls(urlsInput);

    if (urls.length === 0) {
      return;
    }

    setImportStatus('importing');
    setResults([]);
    setProgress({ current: 0, total: urls.length });

    const importResults: ImportResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setCurrentUrl(url);
      setProgress({ current: i + 1, total: urls.length });

      try {
        const apiResult = await api.importChat(url);

        if (apiResult.cached) {
          importResults.push({
            url,
            status: 'duplicate',
            title: apiResult.title,
            messageCount: apiResult.messageCount,
            chatId: apiResult.id,
          });
        } else {
          importResults.push({
            url,
            status: 'success',
            title: apiResult.title,
            messageCount: apiResult.messageCount,
            chatId: apiResult.id,
          });
        }
      } catch (err) {
        importResults.push({
          url,
          status: 'error',
          error: err instanceof Error ? err.message : 'Import failed',
        });
      }

      setResults([...importResults]);
    }

    setCurrentUrl(null);
    setImportStatus('done');

    // Refresh chat list if any were successful
    if (importResults.some(r => r.status === 'success')) {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  }, [urlsInput, queryClient]);

  const reset = () => {
    setUrlsInput('');
    setImportStatus('idle');
    setResults([]);
    setCurrentUrl(null);
    setProgress({ current: 0, total: 0 });
  };

  const validUrlCount = parseUrls(urlsInput).length;
  const successCount = results.filter(r => r.status === 'success').length;
  const duplicateCount = results.filter(r => r.status === 'duplicate').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  // Show admin key input if not set
  if (showAdminKey && !adminKeySet) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Import Chat
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div>
            <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Admin Key
            </label>
            <input
              type="password"
              id="adminKey"
              value={adminKey}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adminKey && handleSaveKey()}
              placeholder="Enter admin key..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleSaveKey}
              disabled={!adminKey}
              className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Chats
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Input state */}
          {importStatus === 'idle' && (
            <>
              <div>
                <label htmlFor="urls" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Claude Share URLs
                </label>
                <textarea
                  id="urls"
                  value={urlsInput}
                  onChange={(e) => setUrlsInput(e.target.value)}
                  placeholder="https://claude.ai/share/abc123&#10;https://claude.ai/share/def456&#10;..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  One URL per line
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={validUrlCount === 0}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {validUrlCount > 0 ? `(${validUrlCount})` : ''}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Importing state */}
          {importStatus === 'importing' && (
            <div className="py-8">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-center text-gray-600 dark:text-gray-300">
                Importing {progress.current} of {progress.total}...
              </p>
              {currentUrl && (
                <p className="text-center text-sm text-gray-400 mt-2 truncate px-4">
                  {currentUrl}
                </p>
              )}

              {/* Show progress results */}
              {results.length > 0 && (
                <div className="mt-4 space-y-1 max-h-40 overflow-y-auto">
                  {results.map((result, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm px-2">
                      {result.status === 'success' && (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {result.status === 'duplicate' && (
                        <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                        </svg>
                      )}
                      {result.status === 'error' && (
                        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className="truncate text-gray-600 dark:text-gray-400">
                        {result.title || result.url}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Done state */}
          {importStatus === 'done' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4 justify-center text-sm flex-wrap">
                {successCount > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    {successCount} imported
                  </span>
                )}
                {duplicateCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {duplicateCount} already exist
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {errorCount} failed
                  </span>
                )}
              </div>

              {/* Results list */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      result.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : result.status === 'duplicate'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.status === 'success' && (
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {result.status === 'duplicate' && (
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {result.status === 'error' && (
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {result.title || result.url}
                        </div>
                        {result.status === 'success' && (
                          <div className="text-gray-500 dark:text-gray-400">
                            {result.messageCount} messages
                          </div>
                        )}
                        {result.status === 'duplicate' && (
                          <div className="text-yellow-700 dark:text-yellow-300">
                            Already imported
                          </div>
                        )}
                        {result.status === 'error' && (
                          <div className="text-red-700 dark:text-red-300">
                            {result.error}
                          </div>
                        )}
                      </div>
                      {(result.status === 'success' || result.status === 'duplicate') && result.chatId && (
                        <button
                          onClick={() => window.open(`/chat/${result.chatId}`, '_blank')}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs flex-shrink-0"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
