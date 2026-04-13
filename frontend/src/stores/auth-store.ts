import { create } from 'zustand';
import { authApi, AuthUser, UserRole, refreshSessionWithStoredToken } from '@/lib/api';
import {
  clearAuthTokens,
  getAccessToken,
  getStoredRefreshToken,
  setAuthFailureHandler,
  setAuthTokens,
} from '@/lib/auth-tokens';

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
      const rt = getStoredRefreshToken();
      if (rt) {
        const ok = await refreshSessionWithStoredToken();
        if (!ok) {
          clearAuthTokens();
          set({ user: null, isLoading: false });
          return;
        }
      }

      if (!getAccessToken()) {
        set({ user: null, isLoading: false });
        return;
      }

      const authUser = await authApi.me();
      set({ user: mapAuthUserToUser(authUser), isLoading: false });
    } catch {
      clearAuthTokens();
      set({ user: null, isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login({ email, password });
      setAuthTokens(data.access_token, data.refresh_token);
      const user = mapAuthUserToUser(data.user);
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
      clearAuthTokens();
      set({ user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

setAuthFailureHandler(() => {
  clearAuthTokens();
  useAuthStore.setState({ user: null, isLoading: false, error: null });
});
