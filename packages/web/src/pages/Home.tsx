import { useState } from 'react';
import ImportModal from '../components/collection/ImportModal';

export default function Home() {
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ConvoVault
          </h1>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Import Chat
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          <p>No chats imported yet.</p>
          <p className="mt-2">Click "Import Chat" to add your first conversation.</p>
        </div>
      </main>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
