import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { BookAppointment } from './pages/BookAppointment';
import { QueueStatus } from './pages/QueueStatus';
import { StaffDashboard } from './pages/StaffDashboard';
import { CheckIn } from './pages/CheckIn';
import { AdminDashboard } from './pages/AdminDashboard';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { QueueDisplay } from './pages/QueueDisplay';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { TrackQueue } from './pages/TrackQueue';
import { MyAppointments } from './pages/MyAppointments';
import { UserProfile } from './pages/UserProfile';
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <SiteSettingsProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
            <Header />
            <main className="flex-grow">
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
          </main>
          <Footer />
        </div>
      </Router>
      </SiteSettingsProvider>
    </AuthProvider>
  );
}

export default App;
