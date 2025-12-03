import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'supervisor' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  team?: string;
  agentId?: string;
}

export const MOCK_USERS: User[] = [
  { id: 'sup-1', email: 'supervisor.ada@demo.com', name: 'Ada', role: 'supervisor', team: 'East' },
  { id: 'sup-2', email: 'supervisor.lee@demo.com', name: 'Lee', role: 'supervisor', team: 'West' },
  { id: 'agent-1', email: 'agent.jordan@demo.com', name: 'Jordan', role: 'agent', agentId: 'a1' },
  { id: 'agent-2', email: 'agent.sam@demo.com', name: 'Sam', role: 'agent', agentId: 'a2' },
  { id: 'agent-3', email: 'agent.renee@demo.com', name: 'Renee', role: 'agent', agentId: 'a3' },
];

interface AuthState {
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
