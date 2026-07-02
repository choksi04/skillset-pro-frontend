import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '@/config/msalConfig';
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
  loginWithAzure: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const msalInstance = new PublicClientApplication(msalConfig);
const msalReady = msalInstance.initialize();

function mapUser(data: any): AuthUser {
  return {
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
  };
}

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
    setUser(mapUser(data));
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem('siap_user_id');
    if (savedId) {
      fetchUser(savedId).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  // Demo email login (fallback)
  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();
    if (error || !data) return { success: false, error: 'No account found with this email.' };
    if (data.status !== 'active') return { success: false, error: 'This account is disabled. Contact your admin.' };
    localStorage.setItem('siap_user_id', data.id);
    setUser(mapUser(data));
    return { success: true };
  };

  // Azure AD SSO login
  const loginWithAzure = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await msalReady;
      const result = await msalInstance.loginPopup(loginRequest);
      const idToken = result.idToken;
      if (!idToken) return { success: false, error: 'No ID token received from Microsoft.' };

      // Validate token via edge function
      const res = await supabase.functions.invoke('validate-azure-token', {
        body: { idToken },
      });

      if (res.error) {
        const msg = typeof res.error === 'object' && 'message' in res.error
          ? (res.error as any).message
          : String(res.error);
        return { success: false, error: msg || 'Authentication failed.' };
      }

      const body = res.data as any;
      if (body?.error) return { success: false, error: body.error };
      if (!body?.user) return { success: false, error: 'No user data returned.' };

      localStorage.setItem('siap_user_id', body.user.id);
      setUser(mapUser(body.user));
      return { success: true };
    } catch (err: any) {
      // User cancelled popup
      if (err?.errorCode === 'user_cancelled') return { success: false, error: 'Sign-in was cancelled.' };
      console.error('Azure login error:', err);
      return { success: false, error: err?.message || 'Microsoft sign-in failed.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('siap_user_id');
    setUser(null);
    // Clear MSAL cache silently
    msalReady.then(() => {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.logoutPopup({ account: accounts[0] }).catch(() => {});
      }
    });
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
        loginWithAzure,
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
