
import React, { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

// Lazy loading components
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));

const LoadingScreen: React.FC<{ message?: string }> = ({ message = "Autenticando Nexus" }) => (
  <div className="min-h-screen bg-nexus-900 flex flex-col items-center justify-center">
    <div className="flex flex-col items-center gap-6 animate-fadeIn">
      <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 transform rotate-3">
         <span className="text-5xl font-black text-white italic">N</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-nexus-400 font-black text-[10px] uppercase tracking-[0.3em]">{message}</p>
      </div>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen message="Carregando Módulo..." />}>
      {isAuthenticated ? <Dashboard /> : <Login />}
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
