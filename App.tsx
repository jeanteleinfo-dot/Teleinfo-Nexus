
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-nexus-900 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 transform rotate-3">
             <span className="text-5xl font-black text-white italic">N</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-nexus-400 font-black text-[10px] uppercase tracking-[0.3em]">Autenticando Nexus</p>
          </div>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <Login />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
