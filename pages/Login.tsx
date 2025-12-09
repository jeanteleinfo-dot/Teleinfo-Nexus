
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = login(username, password);
    if (!success) {
      setError('Credenciais inválidas. Verifique usuário e senha.');
    }
  };

  return (
    <div className="min-h-screen bg-nexus-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md bg-nexus-800/50 backdrop-blur-xl border border-nexus-700 rounded-2xl shadow-2xl p-8 z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-900/50">
            <span className="text-3xl font-bold text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo ao Nexus</h1>
          <p className="text-nexus-400 mt-2">Plataforma Unificada Teleinfo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-nexus-300">Usuário ou Email</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-500" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-nexus-900/50 border border-nexus-600 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Jean.Mendes"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-nexus-300">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-500" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-nexus-900/50 border border-nexus-600 text-white rounded-lg pl-10 pr-10 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-500 hover:text-nexus-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-900/20 transition-all transform active:scale-[0.98]"
          >
            Entrar
          </button>
        </form>
        
        <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
           <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
           <p className="text-xs text-yellow-200/80 text-left">
             <span className="font-bold text-yellow-500 block mb-1">Aviso de Sincronização:</span>
             Este é um sistema de front-end. Os usuários e dados criados são salvos apenas no <strong>Navegador Atual</strong> deste dispositivo. Contas criadas em um computador não estarão visíveis em outro.
           </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-nexus-500">
            Acesso Restrito: <span className="text-nexus-300 font-mono">Jean.Mendes</span>
          </p>
        </div>
      </div>
    </div>
  );
};
