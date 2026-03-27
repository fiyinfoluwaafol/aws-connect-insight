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
