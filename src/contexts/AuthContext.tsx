import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "../data/mockData";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isRecovery: boolean;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (email: string, password?: string, name?: string, acceptedTerms?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserContext: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [loading, setLoading] = useState(true);
  const isRecoveryRef = useRef(false);

  const mapAndSetUser = (data: any) => {
    const mappedUser: User = {
      id: data.id,
      name: data.name,
      email: data.email,
      city: data.city || '',
      country: data.country || '',
      sport: data.sport || '',
      phone: data.phone || '',
      gender: data.gender || '',
      birthDate: data.birth_date || '',
      avatar: data.avatar_url || '',
      plan: data.plan as 'Freemium' | 'Premium',
      userStatus: data.user_status as 'Ativo' | 'Desabilitado',
      campaignsParticipated: data.campaigns_participated,
      campaignsWon: data.campaigns_won,
      photos: [],
      acceptedTerms: data.accepted_terms,
      acceptedTermsAt: data.accepted_terms_at,
    };
    setUser(mappedUser);
    setIsAdmin(data.role === 'ADMIN' || data.email === 'admin@3buk.com' || data.email === 'cristhianbalvin@gmail.com');
  };

  const fetchUserProfile = async (authId: string, authUser?: { email?: string; user_metadata?: any }) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authId)
        .single();

      if (error) {
        // PGRST116 = no rows found — create profile for Google OAuth users
        if (error.code === 'PGRST116' && authUser) {
          const name =
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split('@')[0] ||
            'Atleta';
          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert({
              id: authId,
              name,
              email: authUser.email || '',
              role: 'USUARIO',
              plan: 'Freemium',
              user_status: 'Ativo',
              campaigns_participated: 0,
              campaigns_won: 0,
              accepted_terms: false,
            })
            .select()
            .single();
          if (!insertError && newProfile) {
            mapAndSetUser(newProfile);
          } else {
            console.error('Error creating profile:', insertError);
          }
          return;
        }
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        mapAndSetUser(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Register listener BEFORE getSession so the ref is set before getSession resolves
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecoveryRef.current = true;
        setIsRecovery(true);
        setLoading(false);
        return;
      }
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsRecovery(false);
        setLoading(false);
      }
    });

    // Check active session — skip if recovery event already fired
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (!isRecoveryRef.current) {
          fetchUserProfile(session.user.id, session.user);
        }
      } else {
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

      await fetchUserProfile(data.session.user.id, data.session.user);
    }
  };

  const register = async (email: string, password = 'password123', name = 'Atleta', acceptedTerms = false) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name, 
          role: 'USUARIO',
          accepted_terms: acceptedTerms,
          accepted_terms_at: new Date().toISOString()
        }
      }
    });
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          prompt: 'select_account',
        },
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
    <AuthContext.Provider value={{ user, isAdmin, isRecovery, loading, login, register, loginWithGoogle, logout, updateUserContext }}>
      {children}
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
