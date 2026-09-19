export const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Em produção, usa URLs relativas ('') para passar pelo proxy reverso do vercel.json (evita Mixed Content e CORS)
    return '';
  }

  return 'http://localhost:8000';
};

export const API_BASE = getApiBase();
