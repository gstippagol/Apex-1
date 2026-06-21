import { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const AuthContext = createContext();
const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ isRegistrationOpen: true });
  const socketRef = useRef(null);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/settings`);
      if (res.data.success) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    delete axios.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);

    // Protocol Watcher: Intercept 401/403 errors and force logout
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Check if it's a session expiration error
          const message = error.response.data.message || 'Session Terminated';
          if (message.includes('Multiple logins') || error.response.data.isSessionExpired) {
            alert('MULTIPLE LOGIN DETECTED\n\nYour account was logged in from another device. This session has been terminated for security.');
          }
          console.warn('Security Protocol Violation Detected: Session Terminated');
          logout();
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    fetchSettings();

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Real-time Single Session & Settings Enforcement
  useEffect(() => {
    // Only connect socket if user is logged in
    if (user && user.id) {
      if (!socketRef.current) {
        socketRef.current = io(API_BASE, {
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
      }

      socketRef.current.emit('join-user', user.id);

      socketRef.current.on('force-logout', (data) => {
        alert(`IDENTITY SECURITY BREACH\n\n${data.message}`);
        logout();
        window.location.href = '/login';
      });

      socketRef.current.on('settings-updated', (newSettings) => {
        setSettings(newSettings);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('force-logout');
        socketRef.current.off('settings-updated');
      }
    };
  }, [user]);

  const login = async (email, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
    if (res.data.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      return { success: true };
    }
  };

  const register = async (userData) => {
    const res = await axios.post(`${API_BASE}/api/auth/register`, userData);
    if (res.data.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      return { success: true };
    }
  };

  const sendOTP = async (userData) => {
    const res = await axios.post(`${API_BASE}/api/auth/send-otp`, userData);
    return res.data;
  };

  const verifyOTP = async (verifyData) => {
    const res = await axios.post(`${API_BASE}/api/auth/verify-otp`, verifyData);
    if (res.data.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      return { success: true };
    }
  };

  const forgotPassword = async (email) => {
    const res = await axios.post(`${API_BASE}/api/auth/forgot-password`, { email });
    return res.data;
  };

  const resetPassword = async (resetData) => {
    const res = await axios.post(`${API_BASE}/api/auth/reset-password`, resetData);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, settings, fetchSettings, login, register, logout, sendOTP, verifyOTP, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
