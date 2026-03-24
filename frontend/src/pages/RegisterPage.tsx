import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as THREE from 'three';
import NET from 'vanta/dist/vanta.net.min';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'user'>('user');
  const [registeredRole, setRegisteredRole] = useState<'staff' | 'user'>('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffectRef = useRef<{ destroy: () => void } | null>(null);

  const navigate = useNavigate();
  const { register } = useAuth();

  useEffect(() => {
    if (vantaRef.current) {
      vantaEffectRef.current = NET({
        el: vantaRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 1,
        color: 0x290cd3,
        points: 9,
        maxDistance: 22,
        spacing: 17,
      });
    }

    return () => {
      if (vantaEffectRef.current) {
        vantaEffectRef.current.destroy();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const selectedRole = role;
      await register(name, email, password, confirmPassword, selectedRole);
      setRegisteredRole(selectedRole);
      setSuccess(true);
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div 
        ref={vantaRef} 
        className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center">
              <div className="mb-4 text-7xl">✓</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Registration Successful!</h2>
              <p className="text-gray-600 mb-4">
                {registeredRole === 'staff'
                  ? 'Your staff account has been created and is pending admin approval.'
                  : 'Your user account has been created successfully.'}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Redirecting to login in a few seconds...
              </p>
              <Link
                to="/login"
                className="inline-block bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition shadow-lg hover:shadow-indigo-500/50 transform hover:scale-105"
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={vantaRef} 
      className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 mb-1">VisionBite</h1>
            <p className="text-indigo-600 font-semibold">Authentication System</p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Create Account</h2>
          <p className="text-center text-gray-600 mb-6">Register as customer user or staff member</p>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-800">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="role" className="block text-gray-700 font-semibold mb-2">
                Account Type
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'staff' | 'user')}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition"
              >
                <option value="user">User (Menu + Place Orders)</option>
                <option value="staff">Staff (Needs Admin Approval)</option>
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-gray-700 font-semibold mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-gray-700 font-semibold mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition"
                placeholder="Enter your password"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-gray-700 font-semibold mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition"
                placeholder="Confirm your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/50 transform hover:scale-105 mt-6"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
