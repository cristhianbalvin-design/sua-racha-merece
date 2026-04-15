import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "../data/mockData";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (email: string, password?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserContext: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (data) {
        const mappedUser: User = {
          id: data.id,
          name: data.name,
          email: data.email,
          city: data.city || '',
          country: data.country || '',
          sport: data.sport || '',
          avatar: data.avatar_url || '',
          plan: data.plan as 'Freemium' | 'Premium',
          userStatus: data.user_status as 'Ativo' | 'Desabilitado',
          campaignsParticipated: data.campaigns_participated,
          campaignsWon: data.campaigns_won,
          photos: [], // will migrate fully in next Phase
        };
        setUser(mappedUser);
        setIsAdmin(data.role === 'ADMIN' || data.email === 'admin@3buk.com');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password = 'password123') => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data?.session?.user) {
      // Check if the user's account is enabled before granting access
      const { data: profile } = await supabase
        .from('users')
        .select('user_status, role')
        .eq('id', data.session.user.id)
        .single();

      if (profile && profile.user_status === 'Desabilitado' && profile.role !== 'ADMIN') {
        await supabase.auth.signOut();
        throw new Error('Sua conta está desabilitada. Entre em contato com o administrador.');
      }

      await fetchUserProfile(data.session.user.id);
    }
  };

  const register = async (email: string, password = 'password123', name = 'Atleta') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'USUARIO' }
      }
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateUserContext = (updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, register, logout, updateUserContext }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
