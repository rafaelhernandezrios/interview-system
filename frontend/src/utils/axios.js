import axios from 'axios';

// Usar la URL del backend desde variables de entorno o la URL por defecto
// En producción, debe ser la URL completa del backend
// En desarrollo, usa /api (proxy de Vite)
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://interview-system-c1q9.vercel.app/api' : '/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

