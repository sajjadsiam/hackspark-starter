import axios from 'axios';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: GATEWAY_URL,
  timeout: 30000,
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('rentpi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rentpi_token');
        localStorage.removeItem('rentpi_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const register = (data: { name: string; email: string; password: string }) =>
  api.post('/users/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post('/users/login', data);

export const getMe = () => api.get('/users/me');

export const getDiscount = (userId: number) =>
  api.get(`/users/${userId}/discount`);

// Products
export const getProducts = (params?: Record<string, any>) =>
  api.get('/rentals/products', { params });

export const getProduct = (id: number) =>
  api.get(`/rentals/products/${id}`);

export const getAvailability = (id: number, from: string, to: string) =>
  api.get(`/rentals/products/${id}/availability`, { params: { from, to } });

export const getFreeStreak = (id: number, year: number) =>
  api.get(`/rentals/products/${id}/free-streak`, { params: { year } });

export const getKthBusiestDate = (from: string, to: string, k: number) =>
  api.get('/rentals/kth-busiest-date', { params: { from, to, k } });

export const getTopCategories = (userId: number, k = 5) =>
  api.get(`/rentals/users/${userId}/top-categories`, { params: { k } });

export const getMergedFeed = (productIds: string, limit = 30) =>
  api.get('/rentals/merged-feed', { params: { productIds, limit } });

// Analytics
export const getPeakWindow = (from: string, to: string) =>
  api.get('/analytics/peak-window', { params: { from, to } });

export const getSurgeDays = (month: string) =>
  api.get('/analytics/surge-days', { params: { month } });

export const getRecommendations = (date: string, limit = 6) =>
  api.get('/analytics/recommendations', { params: { date, limit } });

// Chat
export const sendChat = (sessionId: string, message: string) =>
  api.post('/chat', { sessionId, message });

export const getSessions = () =>
  api.get('/chat/sessions');

export const getSessionHistory = (sessionId: string) =>
  api.get(`/chat/${sessionId}/history`);

export const deleteSession = (sessionId: string) =>
  api.delete(`/chat/${sessionId}`);
