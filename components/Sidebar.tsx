import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AppModule, UserRole } from '../types';
import { LayoutDashboard, FileText, Package, Server, LogOut, Shield, Users } from 'lucide-react';

interface SidebarProps {
  currentModule: AppModule;
  onNavigate: (module: AppModule) => void;
  isOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onNavigate, isOpen }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: AppModule.DASHBOARD, label: 'Visão Geral', icon: LayoutDashboard, role: null }, // null role = all
    { id: AppModule.TELEINFO_REPORT, label: 'Relatórios IA', icon: FileText, role: null },
    { id: AppModule.STOCK_MONITOR, label: 'Estoque & Compras', icon: Package, role: null },
    { id: AppModule.TELEINFO_MANAGER, label: 'Teleinfo Manager', icon: Server, role: UserRole.ADMIN },
    { id: AppModule.USER_MANAGEMENT, label: 'Gestão de Usuários', icon: Users, role: UserRole.ADMIN },
  ];

  if (!isOpen) return null;

  return (
    <div className="w-64 bg-nexus-800 border-r border-nexus-700 flex flex-col h-full fixed md:relative z-20 transition-all duration-300">
      <div className="p-6 flex items-center gap-3 border-b border-nexus-700">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">N</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">Nexus</h1>
          <span className="text-xs text-nexus-400">Platform v1.0</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <p className="px-4 text-xs font-semibold text-nexus-500 uppercase tracking-wider mb-2">Módulos</p>
        {menuItems.map((item) => {
          if (item.role && user?.role !== item.role) return null;
          
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' 
                  : 'text-nexus-400 hover:bg-nexus-700 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-nexus-700">
        <div className="flex items-center gap-3 mb-4 px-2">
          <img src={user?.avatar} alt="User" className="w-10 h-10 rounded-full border-2 border-nexus-600" />
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <div className="flex items-center gap-1">
              <Shield size={10} className={user?.role === UserRole.ADMIN ? 'text-yellow-500' : 'text-nexus-400'} />
              <p className="text-xs text-nexus-400 capitalize">{user?.role.toLowerCase()}</p>
            </div>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-nexus-700 text-nexus-300 rounded-lg hover:bg-red-900/30 hover:text-red-400 transition-colors text-sm"
        >
          <LogOut size={16} />
          Sair do Sistema
        </button>
      </div>
    </div>
  );
};