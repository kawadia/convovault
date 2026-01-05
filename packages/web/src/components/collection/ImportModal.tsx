import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAdminKey, isAdmin, api } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

// Extract URL from saved HTML file
function extractUrlFromHtml(html: string): string | null {
  // Try canonical link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch?.[1]?.includes('claude.ai/share/')) return canonicalMatch[1];

  // Try og:url meta tag
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrlMatch?.[1]?.includes('claude.ai/share/')) return ogUrlMatch[1];

  // Try reverse order (content before property)
  const ogUrlMatch2 = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
  if (ogUrlMatch2?.[1]?.includes('claude.ai/share/')) return ogUrlMatch2[1];

  // Try to find claude.ai/share URL in the HTML
  const shareUrlMatch = html.match(/https:\/\/claude\.ai\/share\/[a-zA-Z0-9-]+/);
  if (shareUrlMatch?.[0]) return shareUrlMatch[0];

  return null;
}

// Validate that HTML looks like a Claude share page
function isValidClaudeSharePage(html: string): boolean {
  // Check for Claude-specific markers
  const hasClaudeBranding = html.includes('claude.ai') || html.includes('Claude');
  const hasShareContent = html.includes('data-test-render-count') ||
                          html.includes('font-user-message') ||
                          html.includes('data-is-streaming');
  const hasMessages = html.includes('user') && html.includes('assistant');

  return hasClaudeBranding && (hasShareContent || hasMessages);
}

type UploadStatus = 'idle' | 'uploading' | 'done';

interface FileResult {
  fileName: string;
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

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleSaveKey = () => {
    if (adminKey) {
      setAdminKey(adminKey);
      setAdminKeySet(true);
    }
  };

  const processFile = useCallback(async (file: File): Promise<FileResult> => {
    try {
      const html = await file.text();

      // Validate it's a Claude share page
      if (!isValidClaudeSharePage(html)) {
        return {
          fileName: file.name,
          status: 'error',
          error: 'Not a valid Claude share page',
        };
      }

      const url = extractUrlFromHtml(html);
      if (!url) {
        return {
          fileName: file.name,
          status: 'error',
          error: 'Could not find claude.ai/share URL in the file',
        };
      }

      const result = await api.importChat(url, html);

      // Check if it was a duplicate (cached)
      if (result.cached) {
        return {
          fileName: file.name,
          status: 'duplicate',
          title: result.title,
          messageCount: result.messageCount,
          chatId: result.id,
        };
      }

      return {
        fileName: file.name,
        status: 'success',
        title: result.title,
        messageCount: result.messageCount,
        chatId: result.id,
      };
    } catch (err) {
      return {
        fileName: file.name,
        status: 'error',
        error: err instanceof Error ? err.message : 'Import failed',
      };
    }
  }, []);

  const handleFilesUpload = useCallback(async (files: File[]) => {
    // Filter to only HTML files
    const htmlFiles = files.filter(f =>
      f.name.endsWith('.html') || f.name.endsWith('.htm') || f.type === 'text/html'
    );

    if (htmlFiles.length === 0) {
      setFileResults([{
        fileName: files[0]?.name || 'Unknown',
        status: 'error',
        error: 'Please upload HTML files only',
      }]);
      setUploadStatus('done');
      return;
    }

    setUploadStatus('uploading');
    setFileResults([]);

    const results: FileResult[] = [];
    for (const file of htmlFiles) {
      setCurrentFile(file.name);
      const result = await processFile(file);
      results.push(result);
      setFileResults([...results]);
    }

    setCurrentFile(null);
    setUploadStatus('done');

    // Refresh chat list if any were successful
    if (results.some(r => r.status === 'success')) {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  }, [processFile, queryClient]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  }, [handleFilesUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  }, [handleFilesUpload]);

  const resetUpload = () => {
    setUploadStatus('idle');
    setFileResults([]);
    setCurrentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Count results by status
  const successCount = fileResults.filter(r => r.status === 'success').length;
  const duplicateCount = fileResults.filter(r => r.status === 'duplicate').length;
  const errorCount = fileResults.filter(r => r.status === 'error').length;

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
          {uploadStatus === 'idle' && (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">How to save a chat:</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Open a <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">claude.ai/share/...</code> page</li>
                  <li>Press <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs font-mono">Cmd+S</kbd> (Mac) or <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs font-mono">Ctrl+S</kbd> (Windows)</li>
                  <li>Save as <strong>"Webpage, HTML Only"</strong></li>
                  <li>Upload the file(s) below</li>
                </ol>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-600 dark:text-gray-300 font-medium">
                  Drop HTML files here or click to browse
                </p>
                <p className="text-sm text-gray-400 mt-1">Supports multiple files</p>
              </div>
            </>
          )}

          {uploadStatus === 'uploading' && (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">
                {currentFile ? `Importing ${currentFile}...` : 'Processing...'}
              </p>
              {fileResults.length > 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  {fileResults.length} of {fileResults.length + 1} files processed
                </p>
              )}
            </div>
          )}

          {uploadStatus === 'done' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4 justify-center text-sm">
                {successCount > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ {successCount} imported
                  </span>
                )}
                {duplicateCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    ⊘ {duplicateCount} already exist
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    ✗ {errorCount} failed
                  </span>
                )}
              </div>

              {/* Results list */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fileResults.map((result, index) => (
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
                          {result.title || result.fileName}
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
                  onClick={resetUpload}
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

          {uploadStatus === 'idle' && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
