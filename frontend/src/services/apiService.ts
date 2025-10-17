import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  profilePicture?: string;
  bio?: string;
  preferences?: any;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAccount {
  id: string;
  userId: string;
  platform: string;
  platformUserId: string;
  username: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  planTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface Schedule {
  id: string;
  userId: string;
  postId: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    return response.data;
  },

  register: async (username: string, email: string, password: string) => {
    const response = await apiClient.post('/api/auth/register', { username, email, password });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  },

  refreshToken: async () => {
    const response = await apiClient.post('/api/auth/refresh');
    return response.data;
  },

  oauthCallback: async (platform: string, code: string, state?: string) => {
    const response = await apiClient.post('/api/auth/oauth/callback', {
      platform,
      code,
      state,
      redirectUri: `${window.location.origin}/callback`
    });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/api/users/profile');
    return response.data;
  },

  updateProfile: async (profileData: Partial<User>): Promise<User> => {
    const response = await apiClient.put('/api/users/profile', profileData);
    return response.data;
  },

  getSocialAccounts: async (): Promise<SocialAccount[]> => {
    const response = await apiClient.get('/api/users/social-accounts');
    return response.data;
  },

  disconnectSocialAccount: async (accountId: string) => {
    const response = await apiClient.delete(`/api/users/social-accounts/${accountId}`);
    return response.data;
  },
};

// Posts API
export const postsAPI = {
  getPosts: async (page: number = 1, limit: number = 10): Promise<{ posts: Post[], total: number }> => {
    const response = await apiClient.get(`/api/posts?page=${page}&limit=${limit}`);
    return response.data;
  },

  getPost: async (id: string): Promise<Post> => {
    const response = await apiClient.get(`/api/posts/${id}`);
    return response.data;
  },

  createPost: async (postData: Partial<Post>): Promise<Post> => {
    const response = await apiClient.post('/api/posts', postData);
    return response.data;
  },

  updatePost: async (id: string, postData: Partial<Post>): Promise<Post> => {
    const response = await apiClient.put(`/api/posts/${id}`, postData);
    return response.data;
  },

  deletePost: async (id: string) => {
    const response = await apiClient.delete(`/api/posts/${id}`);
    return response.data;
  },

  publishPost: async (id: string) => {
    const response = await apiClient.post(`/api/posts/${id}/publish`);
    return response.data;
  },

  schedulePost: async (id: string, scheduledAt: string) => {
    const response = await apiClient.post(`/api/posts/${id}/schedule`, { scheduledAt });
    return response.data;
  },
};

// Assets API
export const assetsAPI = {
  uploadAsset: async (file: File): Promise<Asset> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/api/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAssets: async (page: number = 1, limit: number = 10): Promise<{ assets: Asset[], total: number }> => {
    const response = await apiClient.get(`/api/assets?page=${page}&limit=${limit}`);
    return response.data;
  },

  deleteAsset: async (id: string) => {
    const response = await apiClient.delete(`/api/assets/${id}`);
    return response.data;
  },
};

// Schedules API
export const schedulesAPI = {
  getSchedules: async (page: number = 1, limit: number = 10): Promise<{ schedules: Schedule[], total: number }> => {
    const response = await apiClient.get(`/api/schedules?page=${page}&limit=${limit}`);
    return response.data;
  },

  createSchedule: async (scheduleData: Partial<Schedule>): Promise<Schedule> => {
    const response = await apiClient.post('/api/schedules', scheduleData);
    return response.data;
  },

  updateSchedule: async (id: string, scheduleData: Partial<Schedule>): Promise<Schedule> => {
    const response = await apiClient.put(`/api/schedules/${id}`, scheduleData);
    return response.data;
  },

  deleteSchedule: async (id: string) => {
    const response = await apiClient.delete(`/api/schedules/${id}`);
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getOverview: async () => {
    const response = await apiClient.get('/api/analytics/overview');
    return response.data;
  },

  getPostAnalytics: async (postId: string) => {
    const response = await apiClient.get(`/api/analytics/posts/${postId}`);
    return response.data;
  },

  getPlatformAnalytics: async (platform: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await apiClient.get(`/api/analytics/platforms/${platform}?${params}`);
    return response.data;
  },
};

export default apiClient;