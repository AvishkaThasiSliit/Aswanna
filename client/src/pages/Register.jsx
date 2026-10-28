import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/auth.jsx';
import { Sprout } from 'lucide-react';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    district: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: 'farmer',
        phone: formData.phone,
        district: formData.district
      });
      navigate('/setup');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4 py-8">
      <div className="bg-white rounded-card shadow-sm border border-border w-full max-w-md p-6 md:p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
            <Sprout size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center">
            {t('auth.registerTitle')}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-800 border border-rose-300 rounded-control text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              {t('auth.fullNameLabel')}
            </label>
            <input
              type="text"
              name="fullName"
              id="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-control border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-1">
              {t('auth.emailLabel')}
            </label>
            <input
              type="email"
              name="email"
              id="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-control border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-bold text-slate-700 mb-1">
              {t('auth.phoneLabel')}
            </label>
            <input
              type="tel"
              name="phone"
              id="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-control border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="district" className="block text-sm font-bold text-slate-700 mb-1">
              {t('auth.districtLabel')}
            </label>
            <input
              type="text"
              name="district"
              id="district"
              required
              value={formData.district}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-control border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-1">
              {t('auth.passwordLabel')}
            </label>
            <input
              type="password"
              name="password"
              id="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-control border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-navActive text-white font-bold py-2.5 rounded-control transition-colors mt-2 disabled:opacity-70"
          >
            {loading ? '...' : t('auth.registerButton')}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center text-sm">
          <span className="text-slate-500 mr-2">{t('auth.loginPrompt')}</span>
          <Link to="/login" className="text-primary font-bold hover:underline">
            {t('auth.loginLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
