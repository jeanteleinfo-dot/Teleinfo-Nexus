import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { UserPlus, Trash2, Shield, User as UserIcon, Mail, Lock, Key } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { users, addUser, deleteUser, user: currentUser } = useAuth();
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);
  const [error, setError] = useState('');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newName || !newUsername || !newPassword || !newEmail) {
      setError('Todos os campos são obrigatórios.');
      return;
    }

    if (users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
      setError('Este nome de usuário já está em uso.');
      return;
    }

    addUser({
      name: newName,
      username: newUsername,
      email: newEmail,
      password: newPassword,
      role: newRole
    });

    // Reset Form
    setNewName('');
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewRole(UserRole.USER);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserIcon className="text-nexus-400" />
          Gestão de Usuários e Acessos
        </h2>
        <p className="text-nexus-400">Cadastre e gerencie o acesso de administradores e operadores ao sistema.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create User Form */}
        <div className="lg:col-span-1">
          <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 sticky top-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-blue-400" />
              Cadastrar Novo Acesso
            </h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-medium text-nexus-400">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-nexus-900 border border-nexus-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-nexus-400">Username (Login)</label>
                <input 
                  type="text" 
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-nexus-900 border border-nexus-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                  placeholder="Ex: joao.silva"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-nexus-400">Email Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-500" size={14} />
                  <input 
                    type="email" 
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-nexus-900 border border-nexus-600 rounded-lg pl-9 pr-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                    placeholder="joao@teleinfo.com"
                  />
                </div>
              </div>

              <div className="p-3 bg-nexus-900/50 rounded-lg border border-nexus-700 space-y-3">
                <h4 className="text-xs font-semibold text-nexus-300 flex items-center gap-1">
                  <Key size={12} /> Credenciais de Acesso
                </h4>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-nexus-400">Senha Inicial</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-500" size={14} />
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-nexus-900 border border-nexus-600 rounded-lg pl-9 pr-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-nexus-400">Perfil de Acesso</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole(UserRole.USER)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${newRole === UserRole.USER ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-nexus-900 border-nexus-600 text-nexus-400 hover:bg-nexus-700'}`}
                  >
                    Operador
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole(UserRole.ADMIN)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${newRole === UserRole.ADMIN ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-nexus-900 border-nexus-600 text-nexus-400 hover:bg-nexus-700'}`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20 mt-2"
              >
                Cadastrar Usuário
              </button>
            </form>
          </div>
        </div>

        {/* User List */}
        <div className="lg:col-span-2">
          <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
            <div className="p-4 border-b border-nexus-700 flex justify-between items-center">
              <h3 className="font-semibold text-white">Usuários Ativos</h3>
              <span className="bg-nexus-900 text-nexus-400 text-xs px-2 py-1 rounded-full border border-nexus-600">
                Total: {users.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-nexus-300">
                <thead className="bg-nexus-900/50 text-nexus-400 uppercase font-medium text-xs">
                  <tr>
                    <th className="px-6 py-3">Usuário</th>
                    <th className="px-6 py-3">Email / Login</th>
                    <th className="px-6 py-3">Perfil</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-nexus-700/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full bg-nexus-900" />
                          <div>
                            <p className="font-medium text-white">{u.name}</p>
                            {u.id === currentUser?.id && <span className="text-xs text-green-400">(Você)</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-white">{u.email}</span>
                          <span className="text-nexus-500 text-xs">@{u.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === UserRole.ADMIN ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                          {u.role === UserRole.ADMIN && <Shield size={10} />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.username !== 'Jean.Mendes' && u.id !== currentUser?.id && (
                          <button 
                            onClick={() => deleteUser(u.id)}
                            className="p-2 text-nexus-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover acesso"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};