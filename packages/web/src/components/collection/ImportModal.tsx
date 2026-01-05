import { useState } from 'react';
import { setAdminKey, isAdmin } from '../../api/client';

interface ImportModalProps {
  onClose: () => void;
}

// API URL for the bookmarklet
const API_URL = import.meta.env.VITE_API_URL || 'https://convovault-api.kawadia.workers.dev/api/v1';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://convovault.pages.dev';

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
