import React, { createContext, useContext, useState, useEffect } from 'react';

import { getUserById } from '../services/api';

interface UserData { id: string; username: string; full_name?: string; role: 'admin'|'staff'|'doctor'; clinic_id?: string|null; profile_image?: string|null }
interface AuthContextType {
  user: UserData | null;
  login: (user: UserData) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
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

  const refreshUser = async () => {
    if (!user?.id) return;
    try {
      const updatedUser = await getUserById(user.id);
      // Preserve existing fields if not returned, but API returns full object usually
      // Ensure we map the API response to UserData correctly
      const newData: UserData = {
        id: updatedUser.id,
        username: updatedUser.username,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        clinic_id: updatedUser.clinic_id,
        profile_image: updatedUser.profile_image
      };
      setUser(newData);
      localStorage.setItem('opd_user', JSON.stringify(newData));
    } catch (err) {
      console.error('Failed to refresh user data', err);
    }
  };

  // Refresh user data on mount to ensure roles/clinics are up to date
  useEffect(() => {
    if (user?.id) {
      refreshUser();
    }
  }, []); // Run once on mount if user exists

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isAuthenticated: !!user }}>
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
