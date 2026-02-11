
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-nexus-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full"></div>
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute inset-0" />
        </div>
        <p className="text-nexus-400 font-black text-xs uppercase tracking-[0.2em] animate-pulse">Iniciando Nexus</p>
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
