import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
    role: 'staff' | 'user' = 'staff'
  ) => api.post('/auth/register', { name, email, password, confirmPassword, role }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
};

export const adminService = {
  getPendingUsers: () => api.get('/admin/pending-users'),
  approveUser: (id: string) => api.put(`/admin/approve/${id}`),
  rejectUser: (id: string) => api.put(`/admin/reject/${id}`),
  getApprovedStaff: () => api.get('/admin/approved-staff'),
};

export const customerService = {
  enrollCustomer: (data: any) => api.post('/customers/enroll', data),
  getAllCustomers: () => api.get('/customers'),
  getCustomerById: (id: string) => api.get(`/customers/${id}`),
  recognizeCustomer: (faceDescriptor: number[]) => 
    api.post('/customers/recognize', { faceDescriptor }),
  recognizeCustomersBatch: (faceDescriptors: number[][]) =>
    api.post('/customers/recognize-group', { faceDescriptors }),
  matchCustomer: (faceDescriptor: number[]) =>
    api.post('/customers/match', { faceDescriptor }),
  matchCustomersBatch: (faceDescriptors: number[][]) =>
    api.post('/customers/match-group', { faceDescriptors }),
  getRecommendations: (customerId: string, mood: string) =>
    api.post('/customers/recommendations', { customerId, mood }),
  updateCustomer: (id: string, data: any) => api.put(`/customers/${id}`, data),
  deleteCustomer: (id: string) => api.delete(`/customers/${id}`),
};

export const foodService = {
  getAllFoodItems: (params?: any) => api.get('/food', { params }),
  createFoodItem: (data: any) => api.post('/food', data),
  updateFoodItem: (id: string, data: any) => api.put(`/food/${id}`, data),
  deleteFoodItem: (id: string) => api.delete(`/food/${id}`),
};

export const orderService = {
  createOrder: (data: any) => api.post('/orders', data),
  getAllOrders: (params?: any) => api.get('/orders', { params }),
  getMoodInsights: (emotion: string) => api.get('/orders/mood-insights', { params: { emotion } }),
  getOrderById: (id: string) => api.get(`/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
  getCustomerOrders: (customerId: string) => api.get(`/orders/customer/${customerId}`),
};

export default api;
