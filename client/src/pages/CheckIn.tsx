import React, { useState, useEffect } from 'react';
import { selfCheckIn, getQueueSettings } from '../services/api';
import { CheckCircle, AlertCircle, MapPin, Navigation } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getDistanceFromLatLonInKm, HOSPITAL_COORDS } from '../utils/geo';

export const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'location' | 'ticket'>('location');
  const [ticket, setTicket] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [queueEntry, setQueueEntry] = useState<any>(null);
  
  // Dynamic Settings
  const [settings, setSettings] = useState<{ hospital_location?: { latitude: number; longitude: number }; geofence_radius_km: number } | null>(null);

  useEffect(() => {
    // Load settings on mount
    getQueueSettings().then(setSettings).catch(console.error);

    const params = new URLSearchParams(window.location.search);
    const t = params.get('ticket');
    if (t) {
      setStep('ticket');
      setTicket(t);
      setStatus('loading');
      setErrorMsg('');
      selfCheckIn(t)
        .then((res) => {
          setQueueEntry(res.entry);
          setStatus('success');
          if (res.clinicId && res.entry?.ticket_number) {
            navigate(`/queue/${res.clinicId}?ticket=${encodeURIComponent(res.entry.ticket_number)}`);
          }
        })
        .catch((err: any) => {
          setStatus('error');
          setErrorMsg(err.response?.data?.error || 'Check-in failed. Please try again.');
        });
    }
  }, []);
  
  // Location State
  const [verifyingLoc, setVerifyingLoc] = useState(false);
  const [locError, setLocError] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const verifyLocation = () => {
      setVerifyingLoc(true);
      setLocError('');

      // Check for non-secure context (HTTP on network)
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          setLocError('Browser security restricts GPS access on non-secure (HTTP) networks.');
          setVerifyingLoc(false);
          return;
      }

      if (!navigator.geolocation) {
          setLocError('Geolocation is not supported by your browser.');
          setVerifyingLoc(false);
          return;
      }

      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              setCoords({ latitude, longitude });
              
              // Use dynamic settings if available, else fallback to hardcoded
              const targetLat = settings?.hospital_location?.latitude ?? HOSPITAL_COORDS.latitude;
              const targetLon = settings?.hospital_location?.longitude ?? HOSPITAL_COORDS.longitude;
              const maxRadius = settings?.geofence_radius_km ?? 0.5;

              const dist = getDistanceFromLatLonInKm(
                  latitude, 
                  longitude, 
                  targetLat, 
                  targetLon
              );

              // Allow if within radius
              if (dist <= maxRadius) {
                  setStep('ticket');
              } else {
                  setLocError(`You are ${dist.toFixed(2)}km away. You must be at the hospital to check in.`);
              }
              setVerifyingLoc(false);
          },
          (err) => {
              console.error(err);
              let msg = 'Unable to retrieve your location.';
              if (err.code === 1) msg = 'Location access denied. Please enable GPS permissions.';
              if (err.code === 2) msg = 'Location unavailable. Try moving to a better signal area.';
              if (err.code === 3) msg = 'Location request timed out.';
              
              setLocError(msg);
              setVerifyingLoc(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
  };

  const bypassLocation = () => {
      setStep('ticket');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    
    try {
        const res = await selfCheckIn(ticket, coords || undefined);
        setQueueEntry(res.entry);
        setStatus('success');
        if (res.clinicId && res.entry?.ticket_number) {
            navigate(`/queue/${res.clinicId}?ticket=${encodeURIComponent(res.entry.ticket_number)}`);
        }
    } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || 'Check-in failed. Please try again.');
    }
  };

  if (status === 'success') {
      return (
          <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
              <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                  <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">You are Checked In!</h2>
                  <p className="text-gray-600 mb-8">Please have a seat. Your number has been added to the queue.</p>
                  
                  <div className="bg-gray-100 p-6 rounded-lg mb-8">
                      <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Your Ticket Number</p>
                      <p className="text-5xl font-extrabold text-green-600">{queueEntry?.ticket_number}</p>
                  </div>

                  <Link 
                    to="/queue" 
                    className="block w-full py-3 px-4 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 transition"
                  >
                      View Live Queue
                  </Link>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-xl overflow-hidden">
        <div className="bg-green-600 px-6 py-8 text-center">
            <h1 className="text-2xl font-bold text-white">Patient Self Check-in</h1>
            <p className="text-green-100 mt-2">
                {step === 'location' ? 'Verify your location to proceed' : 'Enter your ticket code to join the queue'}
            </p>
        </div>
        
        <div className="p-8">
            {step === 'location' ? (
                <div className="text-center">
                    <div className="bg-blue-50 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-6">
                        <MapPin className="h-12 w-12 text-blue-500" />
                    </div>
                    <p className="text-gray-600 mb-8">
                        To ensure fair queue management, we need to verify that you are physically present at the hospital.
                    </p>

                    {locError && (
                         <div className="bg-red-50 border-l-4 border-red-500 p-4 flex flex-col items-start mb-6 text-left w-full">
                            <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                                <p className="text-sm text-red-700 font-medium">Verification Failed</p>
                            </div>
                            <p className="text-sm text-red-600 mt-1">{locError}</p>
                            
                            {coords && (
                                <p className="text-xs text-red-500 mt-2 font-mono bg-red-100 px-2 py-1 rounded w-full">
                                    Your Location: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                                </p>
                            )}
                            
                            <button 
                                onClick={bypassLocation} 
                                className="mt-3 w-full py-2 px-4 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition flex items-center justify-center"
                            >
                                Simulate Location (Dev Mode)
                            </button>
                        </div>
                    )}

                    <button
                        onClick={verifyLocation}
                        disabled={verifyingLoc}
                        className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {verifyingLoc ? (
                            <>Verifying...</>
                        ) : (
                            <>
                                <Navigation className="h-5 w-5 mr-2" />
                                Verify My Location
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="ticket" className="block text-sm font-medium text-gray-700 mb-2">
                            Ticket Code
                        </label>
                        <input
                            type="text"
                            id="ticket"
                            required
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-green-500 focus:border-green-500 placeholder-gray-400"
                            placeholder="e.g. T-123"
                            value={ticket}
                            onChange={(e) => setTicket(e.target.value)}
                        />
                    </div>

                    {status === 'error' && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                            <p className="text-sm text-red-700">{errorMsg}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? 'Checking in...' : 'Check In'}
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => setStep('location')}
                        className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                        Re-verify Location
                    </button>
                </form>
            )}
            
            <div className="mt-6 text-center">
                <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
                    Back to Home
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
};
