export const API_URL = import.meta.env.VITE_API_URL 
    || import.meta.env.REACT_APP_API_URL 
    || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://api.medcloud.ar' : 'http://localhost:3000');

