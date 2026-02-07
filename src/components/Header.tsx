import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, LogOut, Menu, X, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import Avatar from './Avatar';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { config } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  // Close menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isMenuOpen) setIsMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMenuOpen]);

  // Detect fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // If in fullscreen mode, do not render the header
  if (isFullscreen) return null;
  if (location.pathname.startsWith('/display')) return null;

  const MobileNavLinks = () => (
    <>
      <Link to="/" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Home</Link>
      <Link to="/book" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Book Appointment</Link>
      <Link to="/my-appointments" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>My Appointments</Link>
      <Link to="/check-in" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Self Check-in</Link>
      
      {user ? (
        <>
          <Link to="/profile" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Profile</Link>
          {user.role === 'admin' && (
            <Link to="/admin" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Admin</Link>
          )}
          {user.role === 'staff' && (
            <Link to="/staff" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Staff Dashboard</Link>
          )}
          {user.role === 'doctor' && (
            <Link to="/doctor" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Doctor Dashboard</Link>
          )}
          <button 
            onClick={handleLogout}
            className="flex items-center text-red-600 hover:text-red-700 px-3 py-2 rounded-md text-sm font-medium w-full text-left"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout ({(user as any).full_name || user.username})
          </button>
        </>
      ) : (
        <Link to="/login" className="text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors w-fit" onClick={() => setIsMenuOpen(false)}>
          Staff Login
        </Link>
      )}
    </>
  );

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
          {config.header.logo_url ? (
            <img src={config.header.logo_url} alt={config.header.site_name} className="h-10 w-auto object-contain" />
          ) : (
            <Activity className="h-8 w-8 text-green-600" />
          )}
          <span className="text-xl font-bold text-gray-900">{config.header.site_name}</span>
        </Link>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            <Link to="/" className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium">Home</Link>
            
            {/* Services Dropdown */}
            <div className="relative group">
                <button className="flex items-center text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium focus:outline-none">
                    <span>Patient Services</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                </button>
                <div className="absolute top-full left-0 w-56 bg-white shadow-xl rounded-md py-2 hidden group-hover:block border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                    <Link to="/book" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">Book Appointment</Link>
                    <Link to="/my-appointments" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">My Appointments</Link>
                    <Link to="/check-in" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">Self Check-in</Link>
                </div>
            </div>

            {user ? (
                 <div className="relative group">
                    <button className="flex items-center text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium focus:outline-none">
                        <Avatar srcPath={user.profile_image} username={(user as any).full_name || user.username} size={24} className="mr-2" />
                        <span>{(user as any).full_name || user.username}</span>
                        <ChevronDown className="ml-1 h-4 w-4" />
                    </button>
                    <div className="absolute top-full right-0 w-56 bg-white shadow-xl rounded-md py-2 hidden group-hover:block border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-2 border-b border-gray-100">
                             <p className="text-xs text-gray-500">Signed in as</p>
                             <p className="text-sm font-semibold truncate">{(user as any).full_name || user.username}</p>
                        </div>
                        <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">Profile</Link>
                        {user.role === 'admin' && (
                            <Link to="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">Admin Dashboard</Link>
                        )}
                        {user.role === 'staff' && (
                            <Link to="/staff" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">Staff Dashboard</Link>
                        )}
                        {user.role === 'doctor' && (
                            <Link to="/doctor" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">Doctor Dashboard</Link>
                        )}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                             <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                             </button>
                        </div>
                    </div>
                 </div>
            ) : (
                <Link to="/login" className="text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors">
                  Staff Login
                </Link>
            )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 hover:text-green-600 focus:outline-none p-2">
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-white shadow-lg border-t border-gray-100 py-4 px-4 flex flex-col space-y-2 animate-in slide-in-from-top-2">
            <MobileNavLinks />
        </div>
      )}
    </header>
  );
};
