import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dji_token') || null);
  const [loading, setLoading] = useState(true);
  const [sessionAlert, setSessionAlert] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get(`${API_BASE}/api/auth/me`)
        .then(resp => {
          if (isMounted) {
            setUser(resp.data.user);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('[Auth Check Error]', err);
          if (isMounted) {
            localStorage.removeItem('dji_token');
            delete axios.defaults.headers.common['Authorization'];
            setToken(null);
            setUser(null);
            setLoading(false);
          }
        });
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [token]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401 && error.response.data?.sessionInvalidated) {
          logout('Sessão encerrada: Sua conta foi conectada em outro computador ou navegador.');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (email, password) => {
    const resp = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
    const newToken = resp.data.token;
    localStorage.setItem('dji_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(resp.data.user);
    setSessionAlert('');
    setLoading(false);
    return resp.data;
  };

  const register = async (email, password) => {
    const resp = await axios.post(`${API_BASE}/api/auth/register`, { email, password });
    const newToken = resp.data.token;
    localStorage.setItem('dji_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(resp.data.user);
    setSessionAlert('');
    setLoading(false);
    return resp.data;
  };

  const logout = (alertMsg = '') => {
    localStorage.removeItem('dji_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setLoading(false);
    if (alertMsg) setSessionAlert(alertMsg);
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const resp = await axios.get(`${API_BASE}/api/auth/me`);
        setUser(resp.data.user);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      sessionAlert,
      setSessionAlert,
      login,
      register,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
