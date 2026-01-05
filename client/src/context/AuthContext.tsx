import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserData { id: string; username: string; full_name?: string; role: 'admin'|'staff'|'doctor'; clinic_id?: string|null }
interface AuthContextType {
  user: UserData | null;
  login: (user: UserData) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(() => {
    try {
      const storedUser = localStorage.getItem('opd_user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const login = (userData: UserData) => {
    setUser(userData);
    localStorage.setItem('opd_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('opd_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
