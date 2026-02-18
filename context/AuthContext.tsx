
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  users: User[]; 
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  addUser: (userData: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').timeout(3000);
      if (!error && data) {
        setUsers(data.map(p => ({
          id: p.id,
          username: p.username,
          name: p.name,
          email: p.email,
          role: p.role as UserRole,
          avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=3b82f6&color=fff`
        })));
      }
    } catch (e) {
      console.warn("Profiles fetch non-critical failure.");
    }
  }, []);

  const mapUser = useCallback(async (sbUser: any) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      setUser({
        id: sbUser.id,
        username: profile?.username || sbUser.email?.split('@')[0] || 'usuario',
        name: profile?.name || sbUser.user_metadata?.full_name || 'Usuário Nexus',
        email: sbUser.email,
        role: (profile?.role as UserRole) || UserRole.USER,
        avatar: profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sbUser.email)}&background=3b82f6&color=fff`
      });
    } catch (e) {
      setUser({
        id: sbUser.id,
        username: sbUser.email?.split('@')[0] || 'usuario',
        name: 'Usuário Nexus',
        email: sbUser.email,
        role: UserRole.USER,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(sbUser.email)}&background=3b82f6&color=fff`
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      // Timeout agressivo de 3s para liberar a tela inicial
      const timer = setTimeout(() => {
        if (mounted && loading) setLoading(false);
      }, 3000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          await mapUser(session.user);
          await fetchProfiles();
        }
      } catch (e) {
        console.error("Auth session check failed");
      } finally {
        clearTimeout(timer);
        if (mounted) setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await mapUser(session.user);
        await fetchProfiles();
      } else {
        setUser(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfiles, mapUser]);

  const login = async (email: string, passwordInput: string) => {
    try {
      // Adiciona timeout para a requisição de login
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password: passwordInput }),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Tempo de resposta excedido (Timeout)')), 8000))
      ]);
      
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro inesperado no servidor.' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
    }
  };

  const addUser = async (userData: any) => {
    await supabase.from('profiles').insert([{
      name: userData.name,
      username: userData.username,
      email: userData.email,
      role: userData.role
    }]);
    fetchProfiles();
  };

  const deleteUser = async (id: string) => {
    await supabase.from('profiles').delete().eq('id', id);
    fetchProfiles();
  };

  return (
    <AuthContext.Provider value={{ 
      user, users, loading, login, logout, addUser, deleteUser, isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
