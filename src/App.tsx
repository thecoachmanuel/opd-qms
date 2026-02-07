import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const BookAppointment = lazy(() => import('./pages/BookAppointment').then(m => ({ default: m.BookAppointment })));
const QueueStatus = lazy(() => import('./pages/QueueStatus').then(m => ({ default: m.QueueStatus })));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard').then(m => ({ default: m.StaffDashboard })));
const CheckIn = lazy(() => import('./pages/CheckIn').then(m => ({ default: m.CheckIn })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/Signup').then(m => ({ default: m.Signup })));
const QueueDisplay = lazy(() => import('./pages/QueueDisplay').then(m => ({ default: m.QueueDisplay })));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const TrackQueue = lazy(() => import('./pages/TrackQueue').then(m => ({ default: m.TrackQueue })));
const MyAppointments = lazy(() => import('./pages/MyAppointments').then(m => ({ default: m.MyAppointments })));
const UserProfile = lazy(() => import('./pages/UserProfile').then(m => ({ default: m.UserProfile })));
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if clicked element is a button or inside a button/link
      const clickable = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]');
      
      if (clickable && navigator.vibrate) {
        navigator.vibrate(15); // Light haptic feedback
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <AuthProvider>
      <SiteSettingsProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
            <Header />
            <main className="flex-grow">
              <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/book" element={<BookAppointment />} />
                <Route path="/my-appointments" element={<MyAppointments />} />
                <Route path="/check-in" element={<CheckIn />} />
                <Route path="/track-queue" element={<TrackQueue />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Public Queue Status (Personal) */}
                <Route path="/queue/:clinicId" element={<QueueStatus />} />
                
                {/* TV Display Mode (Public but distinct) */}
                <Route path="/display/:clinicId" element={<QueueDisplay />} />

                {/* Protected Routes */}
                <Route path="/staff" element={
                  <ProtectedRoute roles={['staff', 'admin']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/doctor" element={
                  <ProtectedRoute roles={['doctor', 'admin']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/admin" element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute roles={['admin','staff','doctor']}>
                    <UserProfile />
                  </ProtectedRoute>
                } />
              </Routes>
              </Suspense>
            </main>
          <Footer />
        </div>
      </Router>
      </SiteSettingsProvider>
    </AuthProvider>
  );
}

export default App;
