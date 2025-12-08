import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TeleinfoReport } from '../modules/TeleinfoReport';
import { StockManager } from '../modules/StockManager';
import { TeleinfoManager } from '../modules/TeleinfoManager';
import { UserManagement } from '../modules/UserManagement';
import { AppModule, UserRole } from '../types';
import { Menu, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Dashboard: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<AppModule>(AppModule.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const renderModule = () => {
    switch (currentModule) {
      case AppModule.TELEINFO_REPORT:
        return <TeleinfoReport />;
      case AppModule.STOCK_MONITOR:
        return <StockManager />;
      case AppModule.TELEINFO_MANAGER:
        return <TeleinfoManager />;
      case AppModule.USER_MANAGEMENT:
        return <UserManagement />;
      case AppModule.DASHBOARD:
      default:
        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-6">Visão Geral</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Quick Access Cards */}
              <button onClick={() => setCurrentModule(AppModule.TELEINFO_REPORT)} className="group bg-nexus-800 p-6 rounded-xl border border-nexus-700 hover:border-blue-500/50 transition-all text-left">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Relatórios IA</h3>
                <p className="text-nexus-400 text-sm mt-2">Visualize análises automáticas do Gemini sobre o status do sistema.</p>
              </button>

              <button onClick={() => setCurrentModule(AppModule.STOCK_MONITOR)} className="group bg-nexus-800 p-6 rounded-xl border border-nexus-700 hover:border-blue-500/50 transition-all text-left">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Estoque & Compras</h3>
                <p className="text-nexus-400 text-sm mt-2">Gerencie inventário, níveis mínimos e valores de equipamentos.</p>
              </button>

              {user?.role === UserRole.ADMIN && (
                <button onClick={() => setCurrentModule(AppModule.USER_MANAGEMENT)} className="group bg-nexus-800 p-6 rounded-xl border border-nexus-700 hover:border-green-500/50 transition-all text-left">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Gestão de Usuários</h3>
                  <p className="text-nexus-400 text-sm mt-2">Cadastre novos operadores e gerencie permissões de acesso.</p>
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-nexus-900 overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <Sidebar 
        currentModule={currentModule} 
        onNavigate={(mod) => {
          setCurrentModule(mod);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="h-16 flex items-center justify-between px-4 border-b border-nexus-700 bg-nexus-900/90 backdrop-blur shrink-0">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-nexus-400 hover:bg-nexus-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-4">
             {/* Header actions can go here */}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
};