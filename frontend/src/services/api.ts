import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Validate URL construction
const fullApiUrl = `${API_BASE_URL}/api`;
console.log('API Base URL:', API_BASE_URL);
console.log('Full API URL:', fullApiUrl);

export const api = axios.create({
  baseURL: fullApiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem('auth-storage');
        if (refreshToken) {
          const parsed = JSON.parse(refreshToken);
          if (parsed.state?.refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
              refreshToken: parsed.state.refreshToken,
            });

            const { token } = response.data.data;
            
            // Update the token in localStorage
            const updatedAuth = {
              ...parsed,
              state: {
                ...parsed.state,
                token,
              },
            };
            localStorage.setItem('auth-storage', JSON.stringify(updatedAuth));

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      toast.error('Backend service is not available. Please ensure the backend services are running.');
    } else if (error.response?.data?.error?.message) {
      toast.error(error.response.data.error.message);
    } else if (error.message) {
      toast.error(error.message);
    } else {
      toast.error('An unexpected error occurred');
    }

    return Promise.reject(error);
  }
);

// Initialize auth token from localStorage
const authStorage = localStorage.getItem('auth-storage');
if (authStorage) {
  try {
    const parsed = JSON.parse(authStorage);
    if (parsed.state?.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${parsed.state.token}`;
    }
  } catch (error) {
    // Invalid storage, remove it
    localStorage.removeItem('auth-storage');
  }
}

export default api;
