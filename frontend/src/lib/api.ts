// API client for backend communication. //

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiError {
  detail: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: 'An unexpected error occurred',
      }));
      throw new Error(error.detail);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);

// Auth-specific API functions
export type UserRole = 'supervisor' | 'agent';

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  team_id?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  team_id?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthUser>('/api/auth/login', credentials),

  register: (credentials: RegisterCredentials) =>
    api.post<AuthUser>('/api/auth/register', credentials),

  logout: () => api.post<void>('/api/auth/logout'),

  me: () => api.get<AuthUser>('/api/auth/me'),

  refresh: () => api.post<MessageResponse>('/api/auth/refresh'),

  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post<MessageResponse>('/api/auth/forgot-password', data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<MessageResponse>('/api/auth/reset-password', data),

  changePassword: (data: ChangePasswordRequest) =>
    api.patch<MessageResponse>('/api/auth/change-password', data),
};

// =============================================================================
// Dashboard API Types
// =============================================================================

export interface ApiDailyMetric {
  date: string;
  call_count: number;
  avg_sentiment: number | null;
  avg_duration: number | null;
  negative_call_percent: number;
}

export interface ApiSentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ApiTopicCount {
  name: string;
  count: number;
}

export interface ApiAgentStat {
  agent_id: string;
  name: string;
  call_count: number;
  avg_sentiment: number | null;
}

export interface TrendsResponse {
  daily_metrics: ApiDailyMetric[];
  total_calls: number;
  avg_sentiment: number | null;
  avg_duration: number | null;
  negative_call_percent: number;
  sentiment_distribution: ApiSentimentDistribution;
  top_topics: ApiTopicCount[];
  agent_stats: ApiAgentStat[];
}

// Transformed types for frontend components
export interface DailyMetric {
  date: string;
  avgSentiment: number;
  callCount: number;
  avgDuration: number;
  negativePercent: number;
}

export interface TopicDatum {
  name: string;
  value: number;
}

export interface SentimentDatum {
  name: 'Positive' | 'Neutral' | 'Negative';
  value: number;
  color: string;
}

export interface AgentPerformanceDatum {
  name: string;
  sentiment: number;
  calls: number;
}

export interface DashboardData {
  totalCalls: number;
  avgSentiment: number;
  avgDuration: number | null;
  negativePercent: number;
  negativeCallCount: number;
  dailyMetrics: DailyMetric[];
  topTopics: TopicDatum[];
  sentimentDist: SentimentDatum[];
  agentStats: AgentPerformanceDatum[];
}

// =============================================================================
// Dashboard API
// =============================================================================

function transformTrendsResponse(response: TrendsResponse): DashboardData {
  return {
    totalCalls: response.total_calls,
    avgSentiment: response.avg_sentiment ?? 0,
    avgDuration: response.avg_duration,
    negativePercent: response.negative_call_percent,
    negativeCallCount: response.sentiment_distribution.negative,
    dailyMetrics: response.daily_metrics.map((m) => ({
      date: m.date,
      avgSentiment: m.avg_sentiment ?? 0,
      callCount: m.call_count,
      avgDuration: m.avg_duration ?? 0,
      negativePercent: m.negative_call_percent,
    })),
    topTopics: response.top_topics.map((t) => ({
      name: t.name.replace(/-/g, ' '),
      value: t.count,
    })),
    sentimentDist: [
      { name: 'Positive', value: response.sentiment_distribution.positive, color: 'hsl(var(--success))' },
      { name: 'Neutral', value: response.sentiment_distribution.neutral, color: 'hsl(var(--muted-foreground))' },
      { name: 'Negative', value: response.sentiment_distribution.negative, color: 'hsl(var(--destructive))' },
    ],
    agentStats: response.agent_stats.slice(0, 6).map((a) => ({
      name: a.name.split(' ')[0],
      sentiment: a.avg_sentiment ?? 0,
      calls: a.call_count,
    })),
  };
}

export const dashboardApi = {
  getTrends: (days: number) =>
    api.get<TrendsResponse>(`/api/dashboard/trends?days=${days}`),

  getTrendsTransformed: async (days: number): Promise<DashboardData> => {
    const response = await api.get<TrendsResponse>(`/api/dashboard/trends?days=${days}`);
    return transformTrendsResponse(response);
  },
};

// =============================================================================
// Alerts API Types
// =============================================================================

export type SupervisorAlertSeverity = 'low' | 'medium' | 'high';
export type SupervisorAlertStatus = 'open' | 'closed';
export type SupervisorAlertRuleType =
  | 'sentiment_threshold'
  | 'keyword_match'
  | 'recurring_topic'
  | 'recurring_keyword';
export type SupervisorAlertType = SupervisorAlertRuleType | 'manual';

export interface SupervisorAlertRecord {
  id: string;
  rule_id: string | null;
  type: SupervisorAlertType;
  severity: SupervisorAlertSeverity;
  status: SupervisorAlertStatus;
  is_read: boolean;
  call_id: string | null;
  matched_value: string | null;
  matched_count: number | null;
  window_days: number | null;
  title: string;
  description: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupervisorAlertsListResponse {
  alerts: SupervisorAlertRecord[];
  total: number;
  page: number;
  per_page: number;
}

export interface SupervisorAlertPatchRequest {
  status?: SupervisorAlertStatus;
  is_read?: boolean;
}

export interface CreateManualAlertRequest {
  call_id: string;
}

export interface SupervisorAlertRule {
  id: string;
  type: SupervisorAlertRuleType;
  severity: SupervisorAlertSeverity;
  is_active: boolean;
  team_id: string;
  supervisor_id: string;
  sentiment_below: number | null;
  keyword: string | null;
  topic: string | null;
  min_occurrences: number | null;
  window_days: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupervisorAlertRulesListResponse {
  rules: SupervisorAlertRule[];
}

export interface SupervisorAlertCallsResponse {
  calls: SupervisorCallDetail[];
}

export interface CreateSupervisorAlertRuleRequest {
  type: SupervisorAlertRuleType;
  severity: SupervisorAlertSeverity;
  is_active?: boolean;
  sentiment_below?: number;
  keyword?: string;
  topic?: string;
  min_occurrences?: number;
  window_days?: number;
}

export interface UpdateSupervisorAlertRuleRequest {
  type?: SupervisorAlertRuleType;
  severity?: SupervisorAlertSeverity;
  is_active?: boolean;
  sentiment_below?: number;
  keyword?: string;
  topic?: string;
  min_occurrences?: number;
  window_days?: number;
}

// =============================================================================
// Alerts API
// =============================================================================

function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const alertsApi = {
  listAlerts: (params: {
    status?: SupervisorAlertStatus;
    severity?: SupervisorAlertSeverity;
    type?: SupervisorAlertType;
    is_read?: boolean;
    page?: number;
    per_page?: number;
  } = {}) =>
    api.get<SupervisorAlertsListResponse>(`/api/alerts${toQueryString(params)}`),

  updateAlert: (alertId: string, data: SupervisorAlertPatchRequest) =>
    api.patch<SupervisorAlertRecord>(`/api/alerts/${alertId}`, data),

  createManualAlert: (data: CreateManualAlertRequest) =>
    api.post<SupervisorAlertRecord>('/api/alerts/manual', data),

  listAlertCalls: (alertId: string) =>
    api.get<SupervisorAlertCallsResponse>(`/api/alerts/${alertId}/calls`),

  listRules: (params: { is_active?: boolean } = {}) =>
    api.get<SupervisorAlertRulesListResponse>(`/api/alerts/rules${toQueryString(params)}`),

  createRule: (data: CreateSupervisorAlertRuleRequest) =>
    api.post<SupervisorAlertRule>('/api/alerts/rules', data),

  updateRule: (ruleId: string, data: UpdateSupervisorAlertRuleRequest) =>
    api.patch<SupervisorAlertRule>(`/api/alerts/rules/${ruleId}`, data),
};

// =============================================================================
// Calls API Types
// =============================================================================

export interface SimulateCallResponse {
  call_id: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  summary: string;
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp?: string;
  }>;
  key_moves: string[];
  is_resolved: boolean;
  topics: string[];
  keywords: Record<string, boolean>;
}

export interface SupervisorCallDetail {
  id: string;
  agent_id: string;
  agent_name: string;
  started_at: string | null;
  duration_seconds: number | null;
  sentiment_score: number | null;
  sentiment_label: 'positive' | 'neutral' | 'negative' | null;
  is_resolved: boolean | null;
  topics: string[];
  summary: string | null;
  has_open_alert: boolean;
  open_alert_id: string | null;
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp?: string | null;
  }>;
}

// =============================================================================
// Calls API
// =============================================================================

export const callsApi = {
  getCallById: (callId: string) =>
    api.get<SupervisorCallDetail>(`/api/calls/${callId}`),

  simulateCall: () =>
    api.post<SimulateCallResponse>('/api/calls/simulate'),
};

// =============================================================================
// Teams API Types
// =============================================================================

export interface AgentInfo {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface TeamMembersResponse {
  members: AgentInfo[];
  team_id: string;
}

export interface AvailableAgentsResponse {
  agents: AgentInfo[];
}

export interface AddMemberRequest {
  agent_id: string;
}

// =============================================================================
// Teams API
// =============================================================================

export const teamsApi = {
  getMembers: () =>
    api.get<TeamMembersResponse>('/api/teams/members'),

  getAvailableAgents: () =>
    api.get<AvailableAgentsResponse>('/api/teams/available-agents'),

  addMember: (data: AddMemberRequest) =>
    api.post<MessageResponse>('/api/teams/members', data),

  removeMember: (agentId: string) =>
    api.delete<MessageResponse>(`/api/teams/members/${agentId}`),
};

// =============================================================================
// Agent API Types
// =============================================================================

export interface WeeklyTrendItem {
  day: string;
  sentiment: number;
  calls: number;
}

export interface PerformanceResponse {
  total_calls: number;
  avg_sentiment: number;
  percentile: number;
  weekly_trend: WeeklyTrendItem[];
}

// =============================================================================
// Agent API
// =============================================================================

export const agentApi = {
  getPerformance: () =>
    api.get<PerformanceResponse>('/api/agent/performance'),
};
