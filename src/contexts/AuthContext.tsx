import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '@/types/models';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  organization_name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for development
const mockUser: AuthUser = {
  id: 'user-001',
  email: 'admin@acmecorp.com',
  full_name: 'Sarah Chen',
  role: 'admin',
  tenant_id: 'tenant-001',
  organization_name: 'Acme Corporation',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>(mockUser.role);

  return (
    <AuthContext.Provider
      value={{
        user: mockUser,
        currentRole,
        setCurrentRole,
        isAuthenticated: true,
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
