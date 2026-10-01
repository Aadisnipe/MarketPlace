import axios from 'axios';

// withCredentials lets the browser send the httpOnly auth cookie (Phase 3).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Normalize errors so UI code can rely on error.message / error.errors.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const data = error.response?.data;
    return Promise.reject({
      status: error.response?.status,
      message: data?.message || error.message || 'Network error',
      errors: data?.errors,
    });
  }
);

export default api;
