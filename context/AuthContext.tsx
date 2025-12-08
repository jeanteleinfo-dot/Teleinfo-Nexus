import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (username: string, password: string) => boolean; // Returns success status
  logout: () => void;
  isAuthenticated: boolean;
  addUser: (newUser: Omit<User, 'id' | 'avatar'>) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial Seed User
const MASTER_ADMIN: User = {
  id: 'master-01',
  username: 'Jean.Mendes',
  name: 'Jean Mendes',
  email: 'jean.mendes@teleinfo.com',
  role: UserRole.ADMIN,
  password: 'z@r@b@t@n@2025',
  avatar: 'https://ui-avatars.com/api/?name=Jean+Mendes&background=3b82f6&color=fff'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Initialize Users and Check Session
  useEffect(() => {
    // 1. Load Session
    const storedSession = localStorage.getItem('nexus_session');
    if (storedSession) {
      setUser(JSON.parse(storedSession));
    }

    // 2. Load and Sync Users DB
    const storedUsers = localStorage.getItem('nexus_users_db');
    let usersList: User[] = [];

    if (storedUsers) {
      usersList = JSON.parse(storedUsers);
    }

    // Force sync Master Admin to ensure access
    const adminIndex = usersList.findIndex(u => u.username === MASTER_ADMIN.username);
    if (adminIndex >= 0) {
      // Update existing admin details/password if changed in code
      usersList[adminIndex] = { ...usersList[adminIndex], ...MASTER_ADMIN };
    } else {
      // Create admin if missing
      usersList.push(MASTER_ADMIN);
    }
    
    // Check if list was empty (first run)
    if (!storedUsers) {
      // usersList already has MASTER_ADMIN
    }

    setUsers(usersList);
    localStorage.setItem('nexus_users_db', JSON.stringify(usersList));
  }, []);

  const login = (username: string, passwordInput: string): boolean => {
    const foundUser = users.find(u => 
      (u.username.toLowerCase() === username.toLowerCase() || u.email?.toLowerCase() === username.toLowerCase()) && 
      u.password === passwordInput
    );

    if (foundUser) {
      // Don't store password in session
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = foundUser;
      setUser(safeUser as User);
      localStorage.setItem('nexus_session', JSON.stringify(safeUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_session');
  };

  const addUser = (userData: Omit<User, 'id' | 'avatar'>) => {
    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
      avatar: `https://ui-avatars.com/api/?name=${userData.name}&background=random`
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('nexus_users_db', JSON.stringify(updatedUsers));
  };

  const deleteUser = (id: string) => {
    if (id === MASTER_ADMIN.id) return; // Prevent deleting master admin
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    localStorage.setItem('nexus_users_db', JSON.stringify(updatedUsers));
  };

  return (
    <AuthContext.Provider value={{ user, users, login, logout, isAuthenticated: !!user, addUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};