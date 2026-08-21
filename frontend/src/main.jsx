import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

import { API_URL } from './config'

axios.defaults.baseURL = API_URL;

// Interceptor global para enviar el token y ajustar la URL de la API
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (config.url) {
    if (config.url.startsWith('http://localhost:3000')) {
      config.url = config.url.replace('http://localhost:3000', API_URL);
    } else if (config.url.startsWith('/') && !config.url.startsWith('//')) {
      config.url = `${API_URL}${config.url}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
