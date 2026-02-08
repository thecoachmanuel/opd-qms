import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserData { 
  id: string; 
  username: string; 
  full_name?: string; 
  role: 'admin' | 'staff' | 'doctor'; 
  clinic_id?: string | null;
  email?: string; // Added email field
  profile_image?: string | null;
}

interface AuthContextType {
  user: UserData | null;
  login: (data: any) => void; 
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // If we already have a user in state that matches the session, don't re-fetch
        // This prevents overwriting a valid fallback profile with a failed DB fetch
        setUser(prev => {
            if (prev && prev.id === session.user.id) return prev;
            fetchProfile(session.user);
            return prev;
        });
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (sessionUser: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();
      
      if (data) {
        setUser({
          id: data.id,
          username: data.username,
          full_name: data.full_name,
          role: data.role as 'admin' | 'staff' | 'doctor',
          clinic_id: data.clinic_id,
          email: data.email,
          profile_image: data.profile_image
        });
      } else {
         // If data is null or error occurred, ALWAYS try to fallback to metadata
         // This ensures dashboard access even if the Profiles table sync failed (RLS, triggers, etc.)
         console.warn('AuthContext: Profile fetch failed/missing. Using metadata fallback.', error?.message);
         
         const meta = sessionUser.user_metadata || {};
         // Ensure we have at least a role
         const role = (meta.role as 'admin' | 'staff' | 'doctor') || 'staff';
         
         setUser({
             id: sessionUser.id,
             username: meta.username || sessionUser.email?.split('@')[0] || 'user',
             full_name: meta.full_name || 'User',
             role: role,
             clinic_id: meta.clinic_id,
             email: sessionUser.email,
             profile_image: null,
             approved: true // Fallback to true if using metadata (auth success implies some level of trust, or let ProtectedRoute handle it)
         });
         
         // Optional: Attempt to heal the profile in background
         if (error?.code === 'PGRST116') {
             // Only try to upsert if we know it's missing, to avoid fighting with other errors
             supabase.from('profiles').upsert({
                id: sessionUser.id,
                username: meta.username || sessionUser.email?.split('@')[0] || 'user',
                full_name: meta.full_name || 'User',
                role: role,
                clinic_id: meta.clinic_id,
                email: sessionUser.email,
                approved: true
             }).then(({ error: upsertErr }) => {
                 if (upsertErr) console.warn('AuthContext: Auto-heal failed', upsertErr);
             });
         }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Even in catch, try fallback if we have sessionUser
      if (sessionUser) {
         const meta = sessionUser.user_metadata || {};
         setUser({
             id: sessionUser.id,
             username: meta.username || sessionUser.email?.split('@')[0] || 'user',
             full_name: meta.full_name || 'User',
             role: (meta.role as 'admin' | 'staff' | 'doctor') || 'staff',
             clinic_id: meta.clinic_id,
             email: sessionUser.email
         });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update login to accept profile data directly
   const login = (data: any) => {
       if (data) {
           setUser({
             id: data.id,
             username: data.username,
             full_name: data.full_name,
             role: data.role,
             clinic_id: data.clinic_id,
             email: data.email,
             profile_image: data.profile_image
           });
           setIsLoading(false);
       }
   };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('staff_dashboard_selected_clinic');
    localStorage.removeItem('doctor_dashboard_selected_clinic');
  };

  const refreshProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
          await fetchProfile(session.user);
      }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshProfile, isAuthenticated: !!user, isLoading }}>
      {!isLoading && children}
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
