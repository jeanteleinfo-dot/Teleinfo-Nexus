
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data) {
        setUsers(data.map(p => ({
          id: p.id,
          username: p.username,
          name: p.name,
          email: p.email,
          role: p.role as UserRole,
          avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.name}&background=3b82f6&color=fff`
        })));
      }
    } catch (e) {
      console.error("Error fetching profiles:", e);
    }
  };

  const mapSupabaseUserToNexus = async (sbUser: any) => {
    try {
      // Usamos maybeSingle para não quebrar o fluxo caso o perfil não exista
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      const nexusUser: User = {
        id: sbUser.id,
        username: profile?.username || sbUser.email?.split('@')[0] || 'usuario',
        name: profile?.name || sbUser.user_metadata?.full_name || 'Usuário Nexus',
        email: sbUser.email,
        role: (profile?.role as UserRole) || UserRole.USER,
        avatar: profile?.avatar_url || `https://ui-avatars.com/api/?name=${sbUser.email}&background=3b82f6&color=fff`
      };
      setUser(nexusUser);
    } catch (e) {
      console.error("Critical error mapping user:", e);
      // Fallback para permitir login mesmo com erro de perfil
      setUser({
        id: sbUser.id,
        username: sbUser.email?.split('@')[0] || 'usuario',
        name: 'Usuário Nexus',
        email: sbUser.email,
        role: UserRole.USER,
        avatar: `https://ui-avatars.com/api/?name=${sbUser.email}&background=3b82f6&color=fff`
      });
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await mapSupabaseUserToNexus(session.user);
          await fetchProfiles();
        }
      } catch (e) {
        console.error("Session check error:", e);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await mapSupabaseUserToNexus(session.user);
        await fetchProfiles();
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, passwordInput: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: passwordInput,
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const addUser = async (userData: any) => {
    const { error } = await supabase.from('profiles').insert([{
      name: userData.name,
      username: userData.username,
      email: userData.email,
      role: userData.role
    }]);
    if (!error) fetchProfiles();
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) fetchProfiles();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
