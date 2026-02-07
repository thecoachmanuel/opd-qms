import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';

export const Footer: React.FC = () => {
  const { config } = useSiteSettings();
  const location = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect fullscreen changes to hide footer on display screens
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Hide footer in fullscreen mode, on display screens, or on non-home pages
  if (isFullscreen || location.pathname.startsWith('/display/') || location.pathname !== '/') return null;

  return (
    <footer className="bg-gray-900 text-white pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              {config.header.logo_url ? (
                <img src={config.header.logo_url} alt={config.header.site_name} className="h-8 w-auto object-contain" />
              ) : (
                <Activity className="h-8 w-8 text-green-500" />
              )}
              <span className="text-xl font-bold text-white">{config.header.site_name}</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {config.footer.brand_description}
            </p>
            <div className="flex space-x-4 pt-2">
              {config.footer.social_links.facebook && (
                <a href={config.footer.social_links.facebook} className="text-gray-400 hover:text-green-500 transition-colors"><Facebook className="h-5 w-5" /></a>
              )}
              {config.footer.social_links.twitter && (
                <a href={config.footer.social_links.twitter} className="text-gray-400 hover:text-green-500 transition-colors"><Twitter className="h-5 w-5" /></a>
              )}
              {config.footer.social_links.instagram && (
                <a href={config.footer.social_links.instagram} className="text-gray-400 hover:text-green-500 transition-colors"><Instagram className="h-5 w-5" /></a>
              )}
              {config.footer.social_links.linkedin && (
                <a href={config.footer.social_links.linkedin} className="text-gray-400 hover:text-green-500 transition-colors"><Linkedin className="h-5 w-5" /></a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Home</Link></li>
              <li><Link to="/book" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Book Appointment</Link></li>
              <li><Link to="/track-queue" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Track Live Queue</Link></li>
              <li><Link to="/check-in" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Self Check-in</Link></li>
              <li><Link to="/login" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Staff Login</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Our Services</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-green-500 text-sm transition-colors">General Medicine</a></li>
              <li><a href="#" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Pediatrics</a></li>
              <li><a href="#" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Cardiology</a></li>
              <li><a href="#" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Emergency Care</a></li>
              <li><a href="#" className="text-gray-400 hover:text-green-500 text-sm transition-colors">Laboratory</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3 text-gray-400 text-sm">
                <MapPin className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="whitespace-pre-line">{config.footer.contact_address}</span>
              </li>
              <li className="flex items-center space-x-3 text-gray-400 text-sm">
                <Phone className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span>{config.footer.contact_phone}</span>
              </li>
              <li className="flex items-center space-x-3 text-gray-400 text-sm">
                <Mail className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span>{config.footer.contact_email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} {config.header.site_name}. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">Terms of Service</a>
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
