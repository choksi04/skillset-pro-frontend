import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/models';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  domain_id: string | null;
  department: string;
  designation: string;
  status: string;
  avatar_url: string;
}

interface AuthContextType {
  user: AuthUser | null;
  currentRole: UserRole;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) {
      localStorage.removeItem('siap_user_id');
      setUser(null);
      return;
    }
    setUser({
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role as UserRole,
      tenant_id: data.tenant_id,
      domain_id: data.domain_id,
      department: data.department ?? '',
      designation: data.designation ?? '',
      status: data.status,
      avatar_url: data.avatar_url ?? '',
    });
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem('siap_user_id');
    if (savedId) {
      fetchUser(savedId).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();
    if (error || !data) return { success: false, error: 'No account found with this email.' };
    if (data.status !== 'active') return { success: false, error: 'This account is disabled. Contact your admin.' };
    localStorage.setItem('siap_user_id', data.id);
    setUser({
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role as UserRole,
      tenant_id: data.tenant_id,
      domain_id: data.domain_id,
      department: data.department ?? '',
      designation: data.designation ?? '',
      status: data.status,
      avatar_url: data.avatar_url ?? '',
    });
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('siap_user_id');
    setUser(null);
  };

  const refreshUser = async () => {
    if (user) await fetchUser(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentRole: user?.role ?? 'employee',
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
