import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAdminKey, isAdmin, api } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

// API URL for the bookmarklet
const API_URL = import.meta.env.VITE_API_URL || 'https://convovault-api.kawadia.workers.dev/api/v1';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://convovault.pages.dev';

// Extract URL from saved HTML file
function extractUrlFromHtml(html: string): string | null {
  // Try canonical link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch?.[1]) return canonicalMatch[1];

  // Try og:url meta tag
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrlMatch?.[1]) return ogUrlMatch[1];

  // Try reverse order (content before property)
  const ogUrlMatch2 = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
  if (ogUrlMatch2?.[1]) return ogUrlMatch2[1];

  // Try to find claude.ai/share URL in the HTML
  const shareUrlMatch = html.match(/https:\/\/claude\.ai\/share\/[a-zA-Z0-9-]+/);
  if (shareUrlMatch?.[0]) return shareUrlMatch[0];

  return null;
}

// Generate bookmarklet code - simplified for reliability
function getBookmarkletCode(adminKey: string): string {
  const code = `
(function(){
  if(!location.href.includes('claude.ai/share/')){alert('Use on claude.ai/share page');return;}
  var d=document,b=d.body,o=d.createElement('div');
  o.innerHTML='<div style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center"><div style="background:#fff;padding:24px 32px;border-radius:12px;text-align:center;font-family:system-ui"><div id="cvs" style="color:#6366f1;font-size:18px">Importing...</div></div></div>';
  b.appendChild(o);
  var s=d.getElementById('cvs');
  fetch('${API_URL}/chats/import',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Admin-Key':'${adminKey}'},
    body:JSON.stringify({url:location.href,html:d.documentElement.outerHTML})
  })
  .then(function(r){return r.json()})
  .then(function(d){
    if(d.error){s.style.color='#dc2626';s.textContent='Error: '+d.error;setTimeout(function(){o.remove()},3000);}
    else{s.innerHTML='<div style="color:#059669;font-weight:600">✓ Imported!</div><div style="margin:8px 0;color:#374151">'+d.title+'</div><div style="color:#6b7280;font-size:14px">'+d.messageCount+' messages</div><button onclick="window.open(\\'${APP_URL}/chat/'+d.id+'\\');this.parentElement.parentElement.parentElement.remove()" style="margin-top:12px;padding:8px 20px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer">Open</button>';}
  })
  .catch(function(e){s.style.color='#dc2626';s.textContent='Error: '+e.message;setTimeout(function(){o.remove()},3000);});
})();
`.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURIComponent(code)}`;
}

type ImportMethod = 'choose' | 'file' | 'bookmarklet';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadResult {
  id?: string;
  title?: string;
  messageCount?: number;
  error?: string;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [adminKey, setAdminKeyInput] = useState('');
  const [showAdminKey] = useState(!isAdmin());
  const [adminKeySet, setAdminKeySet] = useState(isAdmin());
  const [importMethod, setImportMethod] = useState<ImportMethod>('choose');

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Get stored admin key or use input
  const effectiveAdminKey = adminKey || localStorage.getItem('convovault-admin-key') || '';

  const handleSaveKey = () => {
    if (adminKey) {
      setAdminKey(adminKey);
      setAdminKeySet(true);
    }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadStatus('uploading');
    setUploadResult(null);

    try {
      const html = await file.text();
      const url = extractUrlFromHtml(html);

      if (!url) {
        setUploadStatus('error');
        setUploadResult({ error: 'Could not find claude.ai/share URL in the file. Make sure you saved a Claude share page.' });
        return;
      }

      const result = await api.importChat(url, html);
      setUploadStatus('success');
      setUploadResult({
        id: result.id,
        title: result.title,
        messageCount: result.messageCount,
      });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    } catch (err) {
      setUploadStatus('error');
      setUploadResult({ error: err instanceof Error ? err.message : 'Import failed' });
    }
  }, [queryClient]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm') || file.type === 'text/html')) {
      handleFileUpload(file);
    } else {
      setUploadStatus('error');
      setUploadResult({ error: 'Please upload an HTML file' });
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

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

        <div className="space-y-4">
          {/* Method Selection */}
          {importMethod === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setImportMethod('file')}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Upload HTML File</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Save page as HTML, then upload here (Recommended)</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setImportMethod('bookmarklet')}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Use Bookmarklet</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">One-click import from share page (Quick)</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* File Upload */}
          {importMethod === 'file' && (
            <div className="space-y-4">
              <button
                onClick={() => { setImportMethod('choose'); setUploadStatus('idle'); setUploadResult(null); }}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {uploadStatus === 'idle' && (
                <>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">How to save the page:</h3>
                    <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                      <li>Open the <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">claude.ai/share/...</code> page</li>
                      <li>Press <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs font-mono">Cmd+S</kbd> (Mac) or <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs font-mono">Ctrl+S</kbd> (Windows)</li>
                      <li>Save as <strong>"Webpage, HTML Only"</strong></li>
                      <li>Upload the file below</li>
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
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                      Drop HTML file here or click to browse
                    </p>
                    <p className="text-sm text-gray-400 mt-1">.html or .htm files</p>
                  </div>
                </>
              )}

              {uploadStatus === 'uploading' && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">Importing chat...</p>
                </div>
              )}

              {uploadStatus === 'success' && uploadResult && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">Imported!</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-1">{uploadResult.title}</p>
                  <p className="text-sm text-gray-400 mb-4">{uploadResult.messageCount} messages</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => window.open(`/chat/${uploadResult.id}`, '_blank')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Open Chat
                    </button>
                    <button
                      onClick={() => { setUploadStatus('idle'); setUploadResult(null); }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Import Another
                    </button>
                  </div>
                </div>
              )}

              {uploadStatus === 'error' && uploadResult && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">Import Failed</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{uploadResult.error}</p>
                  <button
                    onClick={() => { setUploadStatus('idle'); setUploadResult(null); }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bookmarklet Instructions */}
          {importMethod === 'bookmarklet' && (
            <div className="space-y-4">
              <button
                onClick={() => setImportMethod('choose')}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <h3 className="font-medium text-indigo-900 dark:text-indigo-200 mb-2">
                  How to Import
                </h3>
                <ol className="text-sm text-indigo-800 dark:text-indigo-300 space-y-2 list-decimal list-inside">
                  <li>Drag this button to your bookmarks bar:</li>
                </ol>

                <div className="mt-3 flex justify-center">
                  <a
                    href={getBookmarkletCode(effectiveAdminKey)}
                    onClick={(e) => e.preventDefault()}
                    draggable="true"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium cursor-move hover:bg-indigo-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Import to ConvoVault
                  </a>
                </div>

                <ol start={2} className="text-sm text-indigo-800 dark:text-indigo-300 space-y-2 list-decimal list-inside mt-3">
                  <li>Open a <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">claude.ai/share/...</code> page</li>
                  <li>Click the bookmarklet</li>
                  <li>The chat will be imported automatically!</li>
                </ol>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                The bookmarklet captures the page content and sends it to ConvoVault.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
