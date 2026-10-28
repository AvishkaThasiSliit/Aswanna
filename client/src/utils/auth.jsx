import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken, apiFetch } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [farmerProfile, setFarmerProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on initial load using saved token in sessionStorage or localStorage
  useEffect(() => {
    async function restoreSession() {
      const savedToken = sessionStorage.getItem('aswanna_session') || localStorage.getItem('aswanna_session');
      if (savedToken) {
        setAuthToken(savedToken);
        try {
          const res = await apiFetch('/api/auth/me');
          const userData = res?.user || res;
          if (userData?._id || userData?.email) {
            setUser(userData);
            setFarmerProfile(res?.farmerProfile || null);
          } else {
            sessionStorage.removeItem('aswanna_session');
            localStorage.removeItem('aswanna_session');
            setAuthToken(null);
          }
        } catch (err) {
          sessionStorage.removeItem('aswanna_session');
          localStorage.removeItem('aswanna_session');
          setAuthToken(null);
        }
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res?.token) {
      setAuthToken(res.token);
      sessionStorage.setItem('aswanna_session', res.token);
      localStorage.setItem('aswanna_session', res.token);
      setUser(res.user);
      // Fetch profile
      try {
        const meRes = await apiFetch('/api/auth/me');
        if (meRes?.farmerProfile) {
          setFarmerProfile(meRes.farmerProfile);
        }
      } catch (err) {
        // ignore profile fetch failure
      }
    }
    return res;
  };

  const register = async (data) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res?.token) {
      setAuthToken(res.token);
      sessionStorage.setItem('aswanna_session', res.token);
      localStorage.setItem('aswanna_session', res.token);
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    sessionStorage.removeItem('aswanna_session');
    localStorage.removeItem('aswanna_session');
    setAuthToken(null);
    setUser(null);
    setFarmerProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, farmerProfile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
