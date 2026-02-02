import axios from 'axios';

// Usar la URL del backend desde variables de entorno
// En producción, debe estar configurada VITE_API_URL en Vercel
// En desarrollo, usa /api (proxy de Vite)
let API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  // En desarrollo, usar el proxy de Vite
  // En producción, VITE_API_URL debe estar configurada
  API_URL = '/api';
}

// Asegurar que la URL termine con /api si no lo hace (solo en producción)
if (import.meta.env.PROD && API_URL && !API_URL.endsWith('/api')) {
  // Si la URL no termina con /api, agregarlo
  API_URL = API_URL.replace(/\/$/, '') + '/api';
}

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
  (response) => {
    // Si la respuesta es un blob, no intentar parsear como JSON
    if (response.config.responseType === 'blob' || response.data instanceof Blob) {
      return response;
    }
    return response;
  },
  (error) => {
    // Si el error es de un blob response, verificar si es un error JSON
    if (error.config?.responseType === 'blob' && error.response?.data instanceof Blob) {
      // Intentar leer el blob como texto para ver si es un error JSON
      error.response.data.text().then(text => {
        try {
          const jsonError = JSON.parse(text);
          if (jsonError.message) {
            console.error('Error from server:', jsonError.message);
            alert(jsonError.message || 'Error downloading file. Please try again.');
          }
        } catch (e) {
          // No es JSON, es un blob real
          console.error('Error downloading file:', error);
          alert('Error downloading file. Please try again.');
        }
      });
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

