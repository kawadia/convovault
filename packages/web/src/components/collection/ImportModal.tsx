import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAdminKey, isAdmin, api } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

type ImportStatus = 'idle' | 'importing' | 'done';
type ItemStatus = 'pending' | 'importing' | 'success' | 'duplicate' | 'error';

interface ImportItem {
  url: string;
  status: ItemStatus;
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
  const [items, setItems] = useState<ImportItem[]>([]);

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

  // Import a single URL
  const importSingleUrl = async (url: string): Promise<Partial<ImportItem>> => {
    try {
      const apiResult = await api.importChat(url);
      if (apiResult.cached) {
        return {
          status: 'duplicate',
          title: apiResult.title,
          messageCount: apiResult.messageCount,
          chatId: apiResult.id,
        };
      } else {
        return {
          status: 'success',
          title: apiResult.title,
          messageCount: apiResult.messageCount,
          chatId: apiResult.id,
        };
      }
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : 'Import failed',
      };
    }
  };

  const handleImport = useCallback(async () => {
    const urls = parseUrls(urlsInput);
    if (urls.length === 0) return;

    setImportStatus('importing');

    // Initialize all items as pending
    const initialItems: ImportItem[] = urls.map(url => ({
      url,
      status: 'pending',
    }));
    setItems(initialItems);

    // Import each URL sequentially
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // Mark current as importing
      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'importing' } : item
      ));

      const result = await importSingleUrl(url);

      // Update with result
      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, ...result } : item
      ));
    }

    setImportStatus('done');
    queryClient.invalidateQueries({ queryKey: ['chats'] });
  }, [urlsInput, queryClient]);

  // Retry a single failed import
  const handleRetry = useCallback(async (index: number) => {
    const item = items[index];
    if (!item || item.status !== 'error') return;

    // Mark as importing
    setItems(prev => prev.map((it, idx) =>
      idx === index ? { ...it, status: 'importing', error: undefined } : it
    ));

    const result = await importSingleUrl(item.url);

    // Update with result
    setItems(prev => prev.map((it, idx) =>
      idx === index ? { ...it, ...result } : it
    ));

    // Refresh chat list if successful
    if (result.status === 'success') {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  }, [items, queryClient]);

  // Retry all failed imports
  const handleRetryAll = useCallback(async () => {
    const failedIndices = items
      .map((item, idx) => item.status === 'error' ? idx : -1)
      .filter(idx => idx !== -1);

    for (const index of failedIndices) {
      await handleRetry(index);
    }
  }, [items, handleRetry]);

  const reset = () => {
    setUrlsInput('');
    setImportStatus('idle');
    setItems([]);
  };

  const validUrlCount = parseUrls(urlsInput).length;
  const successCount = items.filter(r => r.status === 'success').length;
  const duplicateCount = items.filter(r => r.status === 'duplicate').length;
  const errorCount = items.filter(r => r.status === 'error').length;
  const pendingCount = items.filter(r => r.status === 'pending' || r.status === 'importing').length;

  // Show admin key input if not set
  if (showAdminKey && !adminKeySet) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-text-primary">
              Import Chat
            </h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div>
            <label htmlFor="adminKey" className="block text-sm font-medium text-text-secondary mb-1">
              Admin Key
            </label>
            <input
              type="password"
              id="adminKey"
              value={adminKey}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adminKey && handleSaveKey()}
              placeholder="Enter admin key..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-bg-tertiary text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <button
              onClick={handleSaveKey}
              disabled={!adminKey}
              className="mt-2 w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary">
            Import Chats
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
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
                <label htmlFor="urls" className="block text-sm font-medium text-text-secondary mb-1">
                  Claude Share URLs
                </label>
                <textarea
                  id="urls"
                  value={urlsInput}
                  onChange={(e) => setUrlsInput(e.target.value)}
                  placeholder="https://claude.ai/share/abc123&#10;https://claude.ai/share/def456&#10;..."
                  rows={5}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-bg-tertiary text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                />
                <p className="mt-1 text-sm text-text-muted">
                  One URL per line
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={validUrlCount === 0}
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {validUrlCount > 0 ? `(${validUrlCount})` : ''}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Importing / Done state - show progress for each item */}
          {(importStatus === 'importing' || importStatus === 'done') && (
            <div className="space-y-4">
              {/* Summary */}
              {importStatus === 'done' && (
                <div className="flex gap-4 justify-center text-sm flex-wrap">
                  {successCount > 0 && (
                    <span className="text-green-400">
                      {successCount} imported
                    </span>
                  )}
                  {duplicateCount > 0 && (
                    <span className="text-yellow-400">
                      {duplicateCount} already exist
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-red-400">
                      {errorCount} failed
                    </span>
                  )}
                </div>
              )}

              {/* Progress indicator */}
              {importStatus === 'importing' && (
                <div className="text-center text-sm text-text-secondary">
                  Importing {items.length - pendingCount + 1} of {items.length}...
                </div>
              )}

              {/* Items list with individual progress */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      item.status === 'success'
                        ? 'bg-green-900/20 border border-green-800'
                        : item.status === 'duplicate'
                        ? 'bg-yellow-900/20 border border-yellow-800'
                        : item.status === 'error'
                        ? 'bg-red-900/20 border border-red-800'
                        : item.status === 'importing'
                        ? 'bg-accent/10 border border-accent/30'
                        : 'bg-bg-tertiary border border-border'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Status icon */}
                      {item.status === 'success' && (
                        <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.status === 'duplicate' && (
                        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {item.status === 'error' && (
                        <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {item.status === 'importing' && (
                        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0"></div>
                      )}
                      {item.status === 'pending' && (
                        <div className="w-5 h-5 border-2 border-border rounded-full flex-shrink-0"></div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text-primary truncate">
                          {item.title || item.url.split('/').pop()}
                        </div>

                        {/* Progress bar for importing state */}
                        {item.status === 'importing' && (
                          <div className="mt-2 w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
                            <div className="bg-accent h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                          </div>
                        )}

                        {item.status === 'success' && (
                          <div className="text-text-secondary">
                            {item.messageCount} messages
                          </div>
                        )}
                        {item.status === 'duplicate' && (
                          <div className="text-yellow-300">
                            Already imported
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div className="text-red-300 text-xs">
                            {item.error}
                          </div>
                        )}
                        {item.status === 'pending' && (
                          <div className="text-text-muted">
                            Waiting...
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {(item.status === 'success' || item.status === 'duplicate') && item.chatId && (
                        <button
                          onClick={() => window.open(`/chat/${item.chatId}`, '_blank')}
                          className="text-accent hover:underline text-xs flex-shrink-0"
                        >
                          Open
                        </button>
                      )}
                      {item.status === 'error' && (
                        <button
                          onClick={() => handleRetry(index)}
                          className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 flex-shrink-0"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center pt-2">
                {errorCount > 0 && (
                  <button
                    onClick={handleRetryAll}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Retry All Failed ({errorCount})
                  </button>
                )}
                {importStatus === 'done' && (
                  <button
                    onClick={reset}
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover"
                  >
                    Import More
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-bg-tertiary"
                >
                  {importStatus === 'importing' ? 'Cancel' : 'Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
