import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alert, Call } from '@/lib/mock-data';

interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

interface DailyBrief {
  id: string;
  date: string;
  generatedAt: string;
  content: {
    totalCalls: number;
    avgSentiment: number;
    negativePercent: number;
    deltaVsPrior: number;
    topIssues: string[];
    coachingOpportunities: string[];
    exemplarLinks: string[];
  };
}

interface AgentTip {
  id: string;
  callId: string;
  agentId: string;
  createdAt: string;
  tips: string[];
  reason: string;
  dismissed: boolean;
  bookmarked: boolean;
  helpful: boolean | null;
}

interface CallNote {
  id: string;
  callId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

interface Settings {
  sentimentThreshold: number;
  keywords: string[];
  dataRetentionDays: number;
  slackWebhook: string;
}

interface AppState {
  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  updateAlert: (alertId: string, patch: Partial<Alert>) => void;
  
  // Exemplars
  exemplarCallIds: string[];
  toggleExemplar: (callId: string) => void;
  
  // Bookmarks (for agents)
  bookmarkedExemplars: string[];
  toggleBookmark: (callId: string) => void;
  
  // Notes
  callNotes: CallNote[];
  addNote: (note: Omit<CallNote, 'id' | 'createdAt'>) => void;
  
  // Daily Briefs
  dailyBriefs: DailyBrief[];
  addDailyBrief: (brief: Omit<DailyBrief, 'id' | 'generatedAt'>) => void;
  
  // Sent Emails
  sentEmails: SentEmail[];
  addSentEmail: (email: Omit<SentEmail, 'id' | 'sentAt'>) => void;
  
  // Agent Tips
  agentTips: AgentTip[];
  addAgentTip: (tip: Omit<AgentTip, 'id' | 'createdAt' | 'dismissed' | 'bookmarked' | 'helpful'>) => void;
  updateAgentTip: (tipId: string, patch: Partial<AgentTip>) => void;
  
  // Settings
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  
  // Notifications (for agents)
  notifications: Array<{ id: string; message: string; read: boolean; createdAt: string }>;
  addNotification: (message: string) => void;
  markAllNotificationsRead: () => void;
  
  // Reset
  resetAll: () => void;
}

const defaultSettings: Settings = {
  sentimentThreshold: -0.5,
  keywords: ['refund', 'cancel', 'supervisor', 'complaint', 'chargeback'],
  dataRetentionDays: 30,
  slackWebhook: '',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      alerts: [],
      setAlerts: (alerts) => set({ alerts }),
      updateAlert: (alertId, patch) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, ...patch } : a
          ),
        })),

      exemplarCallIds: [],
      toggleExemplar: (callId) =>
        set((state) => ({
          exemplarCallIds: state.exemplarCallIds.includes(callId)
            ? state.exemplarCallIds.filter((id) => id !== callId)
            : [...state.exemplarCallIds, callId],
        })),

      bookmarkedExemplars: [],
      toggleBookmark: (callId) =>
        set((state) => ({
          bookmarkedExemplars: state.bookmarkedExemplars.includes(callId)
            ? state.bookmarkedExemplars.filter((id) => id !== callId)
            : [...state.bookmarkedExemplars, callId],
        })),

      callNotes: [],
      addNote: (note) =>
        set((state) => ({
          callNotes: [
            ...state.callNotes,
            { ...note, id: `note-${Date.now()}`, createdAt: new Date().toISOString() },
          ],
        })),

      dailyBriefs: [],
      addDailyBrief: (brief) =>
        set((state) => ({
          dailyBriefs: [
            ...state.dailyBriefs,
            { ...brief, id: `brief-${Date.now()}`, generatedAt: new Date().toISOString() },
          ],
        })),

      sentEmails: [],
      addSentEmail: (email) =>
        set((state) => ({
          sentEmails: [
            ...state.sentEmails,
            { ...email, id: `email-${Date.now()}`, sentAt: new Date().toISOString() },
          ],
        })),

      agentTips: [],
      addAgentTip: (tip) =>
        set((state) => ({
          agentTips: [
            ...state.agentTips,
            {
              ...tip,
              id: `tip-${Date.now()}`,
              createdAt: new Date().toISOString(),
              dismissed: false,
              bookmarked: false,
              helpful: null,
            },
          ],
        })),
      updateAgentTip: (tipId, patch) =>
        set((state) => ({
          agentTips: state.agentTips.map((t) =>
            t.id === tipId ? { ...t, ...patch } : t
          ),
        })),

      settings: defaultSettings,
      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),

      notifications: [],
      addNotification: (message) =>
        set((state) => ({
          notifications: [
            { id: `notif-${Date.now()}`, message, read: false, createdAt: new Date().toISOString() },
            ...state.notifications,
          ],
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      resetAll: () =>
        set({
          alerts: [],
          exemplarCallIds: [],
          bookmarkedExemplars: [],
          callNotes: [],
          dailyBriefs: [],
          sentEmails: [],
          agentTips: [],
          settings: defaultSettings,
          notifications: [],
        }),
    }),
    {
      name: 'app-storage',
    }
  )
);
