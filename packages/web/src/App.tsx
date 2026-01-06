import { Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Chat from './pages/Chat';

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat/:id" element={<Chat />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
