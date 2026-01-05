import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAdminKey, isAdmin, api } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

type ImportMode = 'url' | 'file';

// Extract URL from saved HTML file
function extractUrlFromHtml(html: string): string | null {
  // Try "Mark of the Web" comment (added by some browsers when saving)
  // Format: <!-- saved from url=(0060)https://claude.ai/share/... -->
  const motwMatch = html.match(/<!--\s*saved from url=\(\d+\)(https:\/\/claude\.ai\/share\/[a-zA-Z0-9-]+)/i);
  if (motwMatch?.[1]) return motwMatch[1];

  // Try canonical link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch?.[1]?.includes('claude.ai/share/')) return canonicalMatch[1];

  // Try og:url meta tag
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrlMatch?.[1]?.includes('claude.ai/share/')) return ogUrlMatch[1];

  // Try reverse order (content before property)
  const ogUrlMatch2 = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
  if (ogUrlMatch2?.[1]?.includes('claude.ai/share/')) return ogUrlMatch2[1];

  // Try to find claude.ai/share URL anywhere in the HTML
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

type UploadStatus = 'idle' | 'uploading' | 'done' | 'needs-url';

interface FileResult {
  fileName: string;
  status: 'success' | 'duplicate' | 'error' | 'needs-url';
  title?: string;
  messageCount?: number;
  chatId?: string;
  error?: string;
}

interface PendingFile {
  file: File;
  html: string;
  fileName: string;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [adminKey, setAdminKeyInput] = useState('');
  const [showAdminKey] = useState(!isAdmin());
  const [adminKeySet, setAdminKeySet] = useState(isAdmin());

  // Import mode
  const [importMode, setImportMode] = useState<ImportMode>('url');

  // URL import state
  const [urlInput, setUrlInput] = useState('');
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlResult, setUrlResult] = useState<FileResult | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [manualUrls, setManualUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleSaveKey = () => {
    if (adminKey) {
      setAdminKey(adminKey);
      setAdminKeySet(true);
    }
  };

  const handleUrlImport = useCallback(async () => {
    const url = urlInput.trim();

    // Validate URL
    if (!url.includes('claude.ai/share/')) {
      setUrlError('Please enter a valid claude.ai/share URL');
      return;
    }

    setUrlImporting(true);
    setUrlError(null);
    setUrlResult(null);

    try {
      // Import without HTML - the server will use browser rendering
      const apiResult = await api.importChat(url);

      if (apiResult.cached) {
        setUrlResult({
          fileName: 'URL Import',
          status: 'duplicate',
          title: apiResult.title,
          messageCount: apiResult.messageCount,
          chatId: apiResult.id,
        });
      } else {
        setUrlResult({
          fileName: 'URL Import',
          status: 'success',
          title: apiResult.title,
          messageCount: apiResult.messageCount,
          chatId: apiResult.id,
        });
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      setUrlError(errorMessage);
    } finally {
      setUrlImporting(false);
    }
  }, [urlInput, queryClient]);

  const resetUrlImport = () => {
    setUrlInput('');
    setUrlResult(null);
    setUrlError(null);
  };

  const processFile = useCallback(async (file: File, providedUrl?: string): Promise<{ result: FileResult; pending?: PendingFile }> => {
    try {
      const html = await file.text();

      // Validate it's a Claude share page
      if (!isValidClaudeSharePage(html)) {
        return {
          result: {
            fileName: file.name,
            status: 'error',
            error: 'Not a valid Claude share page',
          }
        };
      }

      const url = providedUrl || extractUrlFromHtml(html);
      if (!url) {
        // Return needs-url status so user can provide URL manually
        return {
          result: {
            fileName: file.name,
            status: 'needs-url',
            error: 'URL not found in file',
          },
          pending: { file, html, fileName: file.name }
        };
      }

      // Validate URL format
      if (!url.includes('claude.ai/share/')) {
        return {
          result: {
            fileName: file.name,
            status: 'error',
            error: 'Invalid URL - must be a claude.ai/share link',
          }
        };
      }

      const apiResult = await api.importChat(url, html);

      // Check if it was a duplicate (cached)
      if (apiResult.cached) {
        return {
          result: {
            fileName: file.name,
            status: 'duplicate',
            title: apiResult.title,
            messageCount: apiResult.messageCount,
            chatId: apiResult.id,
          }
        };
      }

      return {
        result: {
          fileName: file.name,
          status: 'success',
          title: apiResult.title,
          messageCount: apiResult.messageCount,
          chatId: apiResult.id,
        }
      };
    } catch (err) {
      return {
        result: {
          fileName: file.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Import failed',
        }
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
    setPendingFiles([]);

    const results: FileResult[] = [];
    const pending: PendingFile[] = [];

    for (const file of htmlFiles) {
      setCurrentFile(file.name);
      const { result, pending: pendingFile } = await processFile(file);
      results.push(result);
      if (pendingFile) {
        pending.push(pendingFile);
      }
      setFileResults([...results]);
    }

    setCurrentFile(null);
    setPendingFiles(pending);

    // If any files need URLs, switch to that state
    if (pending.length > 0) {
      setUploadStatus('needs-url');
    } else {
      setUploadStatus('done');
    }

    // Refresh chat list if any were successful
    if (results.some(r => r.status === 'success')) {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  }, [processFile, queryClient]);

  const handleSubmitUrls = useCallback(async () => {
    setUploadStatus('uploading');

    const updatedResults = [...fileResults];

    for (const pending of pendingFiles) {
      const url = manualUrls[pending.fileName];
      if (!url) continue;

      setCurrentFile(pending.fileName);

      // Re-process with provided URL
      const { result } = await processFile(pending.file, url);

      // Update the result in the array
      const idx = updatedResults.findIndex(r => r.fileName === pending.fileName);
      if (idx >= 0) {
        updatedResults[idx] = result;
      }
      setFileResults([...updatedResults]);
    }

    setCurrentFile(null);
    setPendingFiles([]);
    setManualUrls({});
    setUploadStatus('done');

    // Refresh chat list if any were successful
    if (updatedResults.some(r => r.status === 'success')) {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  }, [fileResults, pendingFiles, manualUrls, processFile, queryClient]);

  const handleSkipUrls = useCallback(() => {
    setUploadStatus('done');
    setPendingFiles([]);
    setManualUrls({});
  }, []);

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
    setPendingFiles([]);
    setManualUrls({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const switchMode = (mode: ImportMode) => {
    setImportMode(mode);
    // Reset both modes when switching
    resetUpload();
    resetUrlImport();
  };

  // Count results by status
  const successCount = fileResults.filter(r => r.status === 'success').length;
  const duplicateCount = fileResults.filter(r => r.status === 'duplicate').length;
  const errorCount = fileResults.filter(r => r.status === 'error').length;
  const needsUrlCount = fileResults.filter(r => r.status === 'needs-url').length;

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
            Import Chat
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs - only show when not in the middle of an operation */}
        {uploadStatus === 'idle' && !urlImporting && !urlResult && (
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              onClick={() => switchMode('url')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                importMode === 'url'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Paste URL
            </button>
            <button
              onClick={() => switchMode('file')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                importMode === 'file'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Upload File
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* URL Import Mode */}
          {importMode === 'url' && uploadStatus === 'idle' && !urlResult && (
            <>
              <div className="space-y-3">
                <div>
                  <label htmlFor="shareUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Claude Share URL
                  </label>
                  <input
                    type="url"
                    id="shareUrl"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !urlImporting && handleUrlImport()}
                    placeholder="https://claude.ai/share/..."
                    disabled={urlImporting}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {urlError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{urlError}</p>
                  </div>
                )}

                <button
                  onClick={handleUrlImport}
                  disabled={urlImporting || !urlInput.trim()}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {urlImporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Importing...
                    </>
                  ) : (
                    'Import'
                  )}
                </button>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                The page will be fetched and imported automatically
              </div>
            </>
          )}

          {/* URL Import Result */}
          {importMode === 'url' && urlResult && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg ${
                  urlResult.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {urlResult.status === 'success' ? (
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {urlResult.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {urlResult.status === 'success'
                        ? `${urlResult.messageCount} messages imported`
                        : 'Already imported'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                {urlResult.chatId && (
                  <button
                    onClick={() => window.open(`/chat/${urlResult.chatId}`, '_blank')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    View Chat
                  </button>
                )}
                <button
                  onClick={resetUrlImport}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Import Another
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

          {/* File Upload Mode */}
          {importMode === 'file' && uploadStatus === 'idle' && (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">How to save a chat:</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Open a <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">claude.ai/share/...</code> page</li>
                  <li><strong>Wait for the page to fully load</strong> (all messages visible)</li>
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

          {uploadStatus === 'needs-url' && (
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
                {needsUrlCount > 0 && (
                  <span className="text-orange-600 dark:text-orange-400">
                    {needsUrlCount} need URL
                  </span>
                )}
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                <h3 className="font-medium text-orange-900 dark:text-orange-200 mb-2">
                  Some files need the share URL
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-300 mb-4">
                  The URL couldn't be extracted from these files. Copy the URL from your browser's address bar when viewing each shared chat.
                </p>

                <div className="space-y-3">
                  {pendingFiles.map((pending) => (
                    <div key={pending.fileName} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {pending.fileName}
                      </label>
                      <input
                        type="url"
                        value={manualUrls[pending.fileName] || ''}
                        onChange={(e) => setManualUrls(prev => ({
                          ...prev,
                          [pending.fileName]: e.target.value
                        }))}
                        placeholder="https://claude.ai/share/..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={handleSubmitUrls}
                  disabled={!pendingFiles.some(p => manualUrls[p.fileName]?.includes('claude.ai/share/'))}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import with URLs
                </button>
                <button
                  onClick={handleSkipUrls}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Skip These
                </button>
              </div>
            </div>
          )}

          {uploadStatus === 'done' && (
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
                {needsUrlCount > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {needsUrlCount} skipped
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
                {fileResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      result.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : result.status === 'duplicate'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : result.status === 'needs-url'
                        ? 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
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
                      {result.status === 'needs-url' && (
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
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
                        {result.status === 'needs-url' && (
                          <div className="text-gray-500 dark:text-gray-400">
                            Skipped - no URL provided
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

          {importMode === 'file' && uploadStatus === 'idle' && (
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
