import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: ('admin' | 'staff' | 'doctor')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for pending approval
  if (user && user.approved !== true) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Role not authorized, redirect to home or unauthorized page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
