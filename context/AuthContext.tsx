
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
      const { data, error } = await supabase.from('profiles').select('*');
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
      console.warn("Background profiles fetch failed - non-blocking.");
    }
  }, []);

  const enrichUserSession = useCallback(async (sbUser: any) => {
    if (!sbUser) return;

    // Definimos um usuário básico IMEDIATAMENTE para liberar a UI
    const basicUser: User = {
      id: sbUser.id,
      username: sbUser.email?.split('@')[0] || 'usuario',
      name: sbUser.user_metadata?.full_name || sbUser.email || 'Usuário Nexus',
      email: sbUser.email || '',
      role: UserRole.USER,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(sbUser.email || 'User')}&background=3b82f6&color=fff`
    };
    
    setUser(basicUser);

    // Tentamos buscar o perfil real em segundo plano sem travar o app
    // Não usamos await aqui para não bloquear o retorno da função
    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbUser.id)
          .maybeSingle();

        if (profile && !error) {
          setUser(prev => prev ? ({
            ...prev,
            username: profile.username || prev.username,
            name: profile.name || prev.name,
            role: (profile.role as UserRole) || prev.role,
            avatar: profile.avatar_url || prev.avatar
          }) : null);
        }
      } catch (e) {
        console.log("Profile enrichment background failed:", e);
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      console.log("AuthContext: Initializing auth...");
      try {
        // Safety timeout to prevent getting stuck in loading state
        const safetyTimeout = setTimeout(() => {
          if (mounted) {
            console.warn("AuthContext: Safety timeout reached, forcing loading false.");
            setLoading(false);
          }
        }, 8000);

        console.log("AuthContext: Getting session...");
        const { data: { session } } = await supabase.auth.getSession();
        clearTimeout(safetyTimeout);
        console.log("AuthContext: Session retrieved:", !!session);

        if (session?.user && mounted) {
          await enrichUserSession(session.user);
          fetchProfiles();
        }
      } catch (e) {
        console.error("AuthContext: Session check error", e);
      } finally {
        if (mounted) {
          console.log("AuthContext: Initialization complete, loading false.");
          setLoading(false);
        }
      }
    };

    initAuth();

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          enrichUserSession(session.user);
          if (event === 'SIGNED_IN') fetchProfiles();
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } catch (e) {
      console.error("Auth subscription error", e);
      setLoading(false);
      return () => { mounted = false; };
    }
  }, [enrichUserSession, fetchProfiles]);

  const login = async (email: string, passwordInput: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: passwordInput,
      });
      
      if (error) throw error;
      
      if (data?.user) {
        await enrichUserSession(data.user);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, error: error.message || 'Falha na autenticação.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const addUser = async (userData: any) => {
    await supabase.from('profiles').insert([userData]);
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
