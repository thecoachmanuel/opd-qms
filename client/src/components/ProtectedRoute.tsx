import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: ('admin' | 'staff' | 'doctor')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Role not authorized, redirect to home or unauthorized page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
