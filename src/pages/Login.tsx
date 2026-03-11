
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setIsSubmitting(true);
    
    // Safety timeout: if we're still here after 8 seconds, reset submitting state
    const timeout = setTimeout(() => {
      setIsSubmitting(false);
    }, 8000);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Credenciais inválidas. Verifique seu email e senha.');
        setIsSubmitting(false);
        clearTimeout(timeout);
      }
      // Se sucesso, o AuthContext atualizará o estado global e o App.tsx redirecionará
    } catch (err) {
      setError('Erro de conexão com o servidor. Tente novamente.');
      setIsSubmitting(false);
      clearTimeout(timeout);
    }
  };

  return (
    <div className="min-h-screen bg-nexus-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-nexus-800/40 backdrop-blur-2xl border border-nexus-700/50 rounded-3xl shadow-2xl p-8 md:p-10 z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mx-auto flex items-center justify-center mb-6 shadow-2xl shadow-blue-900/40 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            <span className="text-5xl font-black text-white italic">N</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Plataforma Nexus</h1>
          <p className="text-nexus-500 text-sm mt-1 font-medium">Controle de Engenharia e Auditoria</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-nexus-400 uppercase tracking-widest ml-1">Email Corporativo</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-nexus-500 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-nexus-900/50 border border-nexus-700 text-white rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50 text-sm"
                placeholder="exemplo@teleinfo.com.br"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-nexus-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-nexus-500 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-nexus-900/50 border border-nexus-700 text-white rounded-2xl pl-12 pr-12 py-3.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50 text-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-nexus-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-900/30 transition-all transform active:scale-[0.97] flex items-center justify-center gap-3 disabled:opacity-80 disabled:cursor-not-allowed mt-4 uppercase text-xs tracking-widest"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Validando Acesso...
              </>
            ) : (
              'Entrar no Nexus'
            )}
          </button>
        </form>

        <div className="mt-10 text-center border-t border-nexus-700/50 pt-8">
          <p className="text-[9px] text-nexus-500 uppercase font-black tracking-[0.2em]">
            &copy; 2025 Teleinfo Engenharia • TI
          </p>
        </div>
      </div>
    </div>
  );
};
