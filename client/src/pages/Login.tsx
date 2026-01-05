import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authLogin } from '../services/api';
import { Lock, User } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingApproval(false);
    try {
      const resp = await authLogin(username, password);
      login(resp);
      if (resp.role === 'admin') navigate('/admin');
      else if (resp.role === 'staff') navigate('/staff');
      else navigate('/doctor');
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error === 'Account pending approval') {
        setPendingApproval(true);
      } else {
        setError('Invalid credentials');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
          <p className="text-gray-500 mt-2">Access the OPD Management System</p>
        </div>

        {pendingApproval && (
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md mb-6 text-sm border border-yellow-200">
            <div className="font-bold flex items-center mb-1">
              <User className="h-4 w-4 mr-2" />
              Account Pending Approval
            </div>
            Your account has been created but requires administrator approval before you can sign in. Please contact your administrator.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username or Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                placeholder="Enter username or full name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Don't have an account? <Link to="/signup" className="text-green-600 hover:underline">Sign up</Link>
        </div>
  </div>
  </div>
  );
};
