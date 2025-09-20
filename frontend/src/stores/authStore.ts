import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  kycStatus: string;
  kycLevel: number;
  riskScore: number;
  mfaEnabled: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  countryCode: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string, mfaCode?: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', {
            email,
            password,
            mfaCode,
          });

          const { user, token, refreshToken } = response.data.data;
          
          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Set default authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (userData: RegisterData) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', userData);
          
          const { user, token, refreshToken } = response.data.data;
          
          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Set default authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        const { token } = get();
        
        // Call logout API if token exists
        if (token) {
          api.post('/auth/logout').catch(() => {
            // Ignore errors on logout
          });
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });

        // Remove authorization header
        delete api.defaults.headers.common['Authorization'];
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          get().logout();
          return;
        }

        try {
          const response = await api.post('/auth/refresh', {
            refreshToken,
          });

          const { token } = response.data.data;
          
          set({
            token,
            isAuthenticated: true,
          });

          // Update authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (error) {
          get().logout();
        }
      },

      updateProfile: (data: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...data },
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
