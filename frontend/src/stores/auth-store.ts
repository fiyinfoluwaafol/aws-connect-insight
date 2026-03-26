import { create } from 'zustand';
import { authApi, AuthUser, UserRole } from '@/lib/api';

export type { UserRole } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  teamId?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function mapAuthUserToUser(authUser: AuthUser): User | null {
  // Require role from backend - don't guess from email
  if (!authUser.role) {
    return null;
  }

  return {
    id: authUser.id,
    email: authUser.email,
    firstName: authUser.first_name || '',
    lastName: authUser.last_name || '',
    role: authUser.role,
    teamId: authUser.team_id,
  };
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  error: null,

  initAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const authUser = await authApi.me();
      set({ user: mapAuthUserToUser(authUser), isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const authUser = await authApi.login({ email, password });
      const user = mapAuthUserToUser(authUser);
      if (!user) {
        throw new Error('User profile not found. Please contact support.');
      }
      set({ user, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors - clear state anyway
    } finally {
      set({ user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
