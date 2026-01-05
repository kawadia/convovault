import { useState } from 'react';
import { setAdminKey, isAdmin } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

// API URL for the bookmarklet
const API_URL = import.meta.env.VITE_API_URL || 'https://convovault-api.kawadia.workers.dev/api/v1';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://convovault.pages.dev';

// Generate bookmarklet code with visual feedback overlay
function getBookmarkletCode(adminKey: string): string {
  const code = `
(function() {
  if (!location.href.includes('claude.ai/share/')) {
    alert('Please use this bookmarklet on a claude.ai/share page');
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'convovault-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';

  var box = document.createElement('div');
  box.style.cssText = 'background:white;padding:32px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 25px 50px rgba(0,0,0,0.25)';

  var spinner = document.createElement('div');
  spinner.style.cssText = 'width:48px;height:48px;border:4px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:cvspin 1s linear infinite;margin:0 auto 16px';

  var style = document.createElement('style');
  style.textContent = '@keyframes cvspin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  var text = document.createElement('div');
  text.style.cssText = 'color:#374151;font-size:16px;font-weight:500';
  text.textContent = 'Importing to ConvoVault...';

  box.appendChild(spinner);
  box.appendChild(text);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  var html = document.documentElement.outerHTML;
  var url = location.href;

  fetch('${API_URL}/chats/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': '${adminKey}'
    },
    body: JSON.stringify({ url: url, html: html })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.error) {
      spinner.style.display = 'none';
      text.style.color = '#dc2626';
      text.innerHTML = '<strong>Import failed</strong><br><span style="font-size:14px;color:#6b7280">' + data.error + '</span>';
      setTimeout(function() { overlay.remove(); }, 3000);
    } else {
      spinner.style.cssText = 'width:48px;height:48px;background:#10b981;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center';
      spinner.innerHTML = '<svg width="24" height="24" fill="none" stroke="white" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>';
      text.innerHTML = '<strong style="color:#059669">Imported!</strong><br><span style="font-size:14px;color:#374151">' + data.title + '</span><br><span style="font-size:13px;color:#6b7280">' + data.messageCount + ' messages</span>';

      var btn = document.createElement('button');
      btn.style.cssText = 'margin-top:16px;padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer';
      btn.textContent = 'Open in ConvoVault';
      btn.onclick = function() { window.open('${APP_URL}/chat/' + data.id, '_blank'); overlay.remove(); };
      box.appendChild(btn);

      var close = document.createElement('button');
      close.style.cssText = 'display:block;margin:8px auto 0;padding:8px 16px;background:transparent;color:#6b7280;border:none;font-size:13px;cursor:pointer';
      close.textContent = 'Close';
      close.onclick = function() { overlay.remove(); };
      box.appendChild(close);
    }
  })
  .catch(function(e) {
    spinner.style.display = 'none';
    text.style.color = '#dc2626';
    text.innerHTML = '<strong>Import failed</strong><br><span style="font-size:14px;color:#6b7280">' + e.message + '</span>';
    setTimeout(function() { overlay.remove(); }, 3000);
  });
})();
`.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURIComponent(code)}`;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [adminKey, setAdminKeyInput] = useState('');
  const [showAdminKey] = useState(!isAdmin());
  const [showBookmarklet, setShowBookmarklet] = useState(false);

  // Get stored admin key or use input
  const effectiveAdminKey = adminKey || localStorage.getItem('convovault-admin-key') || '';

  const handleSaveKey = () => {
    if (adminKey) {
      setAdminKey(adminKey);
      setShowBookmarklet(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
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

        <div className="space-y-4">
          {/* Admin Key Section */}
          {showAdminKey && !showBookmarklet && (
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
          )}

          {/* Bookmarklet Instructions */}
          {(showBookmarklet || isAdmin()) && (
            <div className="space-y-4">
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
