import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getClinics, getQueueStatus, updateQueueStatus, getAppointmentById, getPatientHistory, ensureUserProfile } from '../services/api';
import { User, FileText, CheckCircle, Clock, Activity, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DoctorDashboard: React.FC = () => {
    const { user } = useAuth();
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<string>(() => {
        return localStorage.getItem('doctor_dashboard_selected_clinic') || user?.clinic_id || '';
    });
    const [currentPatient, setCurrentPatient] = useState<any>(null);
    const [waitingQueue, setWaitingQueue] = useState<any[]>([]);

    useEffect(() => {
        if (selectedClinic) {
            localStorage.setItem('doctor_dashboard_selected_clinic', selectedClinic);
        }
    }, [selectedClinic]);
    const [patientDetails, setPatientDetails] = useState<any>(null);
    const [patientHistory, setPatientHistory] = useState<any[]>([]);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Refs for optimization
    const currentPatientIdRef = React.useRef<string | null>(null);
    const waitingQueueStrRef = React.useRef<string>('');

    useEffect(() => {
        if (user) {
            // Proactively ensure profile exists to avoid foreign key errors during updates
            ensureUserProfile(user).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        getClinics().then(setClinics);
    }, []);

    useEffect(() => {
        if (user?.clinic_id) {
            setSelectedClinic(user.clinic_id);
        }
    }, [user?.clinic_id]);

    useEffect(() => {
        if (!selectedClinic) return;

        loadCurrentPatient();

        // Subscribe to real-time queue changes
        const channel = supabase
            .channel(`doctor-dashboard-${selectedClinic}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'queue', filter: `clinic_id=eq.${selectedClinic}` },
                () => {
                    loadCurrentPatient(true);
                }
            )
            .subscribe();

        // Poll every 100ms for near-instant updates
        const interval = setInterval(() => loadCurrentPatient(true), 100);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [selectedClinic]);

    // Fetch details when current patient changes
    useEffect(() => {
        if (currentPatient && currentPatient.appointment_id) {
            // Reset notes or load from DB (prevents notes leaking between patients)
            // Since we optimize currentPatient to only update on ID change, this is safe.
            setNotes(currentPatient.consultation_notes || '');

            const fetchDetails = async () => {
                try {
                    const apt = await getAppointmentById(currentPatient.appointment_id);
                    if (apt && apt.patient) {
                        setPatientDetails(apt.patient);
                        const history = await getPatientHistory(apt.patient.id);
                        // Filter out current appointment from history
                        setPatientHistory(history.filter((h: any) => h.id !== apt.id));
                    }
                } catch (err) {
                    console.error('Failed to load patient details', err);
                }
            };
            fetchDetails();
        } else {
            setPatientDetails(null);
            setPatientHistory([]);
            setNotes('');
        }
    }, [currentPatient]);

    const loadCurrentPatient = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await getQueueStatus(selectedClinic);
            
            // Handle multiple serving patients (FIFO)
            const allServing = data.queue.filter((q: any) => q.status === 'serving');
            
            // Sort serving patients by arrival time (or when they were called if available)
            // Assuming arrival_time is the best proxy for order
            allServing.sort((a: any, b: any) => new Date(a.arrival_time).getTime() - new Date(b.arrival_time).getTime());

            const current = allServing.length > 0 ? allServing[0] : null;
            const queuedServing = allServing.length > 1 ? allServing.slice(1) : [];

            const waiting = data.queue.filter((q: any) => q.status === 'waiting');
            
            // Combine queuedServing (high priority) and waiting
            // We add a 'status_label' to distinguish them in the UI if needed
            const combinedWaiting = [
                ...queuedServing.map((q: any) => ({ ...q, is_next: true })),
                ...waiting
            ];

            // Optimize: Only update state if changed
            if (current?.id !== currentPatientIdRef.current) {
                currentPatientIdRef.current = current?.id || null;
                setCurrentPatient(current);
            }

            const newQueueStr = JSON.stringify(combinedWaiting.map((q: any) => q.id));
            if (newQueueStr !== waitingQueueStrRef.current) {
                waitingQueueStrRef.current = newQueueStr;
                setWaitingQueue(combinedWaiting);
            }
        } catch (err) {
            console.warn("Failed to load current patient", err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleCall = async (id: string) => {
        try {
            await updateQueueStatus(id, 'serving', selectedClinic, undefined, user?.role as any, user?.id);
        } catch (err: any) {
            console.error('Call patient error:', err);
            // If FK error, try to fix profile and retry
            if (err.message?.includes('queue_doctor_id_fkey') && user) {
                 try {
                     await ensureUserProfile(user);
                     await updateQueueStatus(id, 'serving', selectedClinic, undefined, user?.role as any, user?.id);
                     return;
                 } catch (retryErr: any) {
                     if (retryErr.message?.includes('row-level security')) {
                         alert('Failed to auto-create profile: RLS Policy blocked it. Please run migration "20250207160000_fix_profile_rls.sql" in Supabase.');
                     } else {
                        alert('Failed to call patient (Profile Error): ' + retryErr.message);
                     }
                 }
            } else {
                alert('Failed to call patient: ' + (err.message || JSON.stringify(err)));
            }
        }
    };

    const handleComplete = async () => {
        if (!currentPatient) return;
        try {
            await updateQueueStatus(currentPatient.id, 'done', selectedClinic, notes, user?.role as any, user?.id);
            setNotes('');
            setCurrentPatient(null);
            alert('Consultation Completed');
        } catch (err: any) {
            console.error('Complete consultation error:', err);
            
            // If FK error, try to fix profile and retry
            if (err.message?.includes('queue_doctor_id_fkey') && user) {
                 try {
                     await ensureUserProfile(user);
                     await updateQueueStatus(currentPatient.id, 'done', selectedClinic, notes, user?.role as any, user?.id);
                     setNotes('');
                     setCurrentPatient(null);
                     alert('Consultation Completed');
                     return;
                 } catch (retryErr: any) {
                     if (retryErr.message?.includes('row-level security')) {
                         alert('Failed to auto-create profile: RLS Policy blocked it. Please run migration "20250207160000_fix_profile_rls.sql" in Supabase.');
                     } else {
                        alert('Failed to complete (Profile Error): ' + retryErr.message);
                     }
                 }
            } else {
                alert('Failed to complete: ' + (err.message || JSON.stringify(err)));
            }
        }
    };

    if (!selectedClinic) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Doctor Login / Select Clinic</h2>
                    
                    {loading ? (
                         <div className="flex justify-center mb-4">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                         </div>
                    ) : (
                        <select
                            className="block w-full p-3 border border-gray-300 rounded-md focus:ring-blue-600 focus:border-blue-600"
                            onChange={(e) => setSelectedClinic(e.target.value)}
                            value={selectedClinic}
                        >
                            <option value="">-- Select Your Clinic --</option>
                            {clinics.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                     <div>
                        <h1 className="text-3xl font-bold text-gray-800">Doctor Dashboard</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-gray-600">Clinic: <span className="font-semibold text-blue-600">{clinics.find(c => c.id === selectedClinic)?.name}</span></p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Patient Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Current Patient Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <User className="h-6 w-6" />
                                    Current Patient
                                </h2>
                                <p className="opacity-90 mt-1">Ticket: {currentPatient?.ticket_number || '--'}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm opacity-75">Status</div>
                                <div className="font-bold uppercase tracking-wide">
                                    {currentPatient ? 'In Consultation' : 'Waiting for Patient'}
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            {currentPatient ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                                            {currentPatient.patient_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">{currentPatient.patient_name}</h3>
                                            <p className="text-gray-500">File No: {patientDetails?.file_no || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <span className="text-sm text-gray-500 block mb-1">Phone</span>
                                            <span className="font-medium">{patientDetails?.phone || 'N/A'}</span>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <span className="text-sm text-gray-500 block mb-1">Arrival Time</span>
                                            <span className="font-medium">
                                                {currentPatient?.arrival_time ? new Date(currentPatient.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <FileText className="h-4 w-4 inline mr-1" />
                                            Consultation Notes
                                        </label>
                                        <textarea
                                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter symptoms, diagnosis, and prescription..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleComplete}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="h-5 w-5" />
                                            Complete Consultation
                                        </button>
                                        <button
                                            onClick={() => handleCall(currentPatient.id)}
                                            className="px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                                            title="Call Again / Re-announce"
                                        >
                                            <span className="sr-only">Call Again</span>
                                            📢
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white">
                                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                        <h3 className="text-lg font-medium text-gray-900">Waiting Room ({waitingQueue.length})</h3>
                                        <p className="text-sm text-gray-500">Call the next patient when ready.</p>
                                    </div>
                                    {waitingQueue.length > 0 ? (
                                        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                                            {waitingQueue.map((item) => (
                                                <li key={item.id} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${item.is_next ? 'bg-blue-50' : ''}`}>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl font-bold text-gray-900">{item.ticket_number}</span>
                                                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                                                {new Date(item.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                            {item.is_next && (
                                                                <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                                                    CALLED
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-gray-600">{item.patient_name || 'Walk-in Patient'}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleCall(item.id)}
                                                        className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-1 shadow-sm ${item.is_next ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                                    >
                                                        {item.is_next ? 'Accept Now' : 'Call Now'}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500">
                                            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                            <p className="text-lg">No patients waiting.</p>
                                            <p className="text-sm">Enjoy your break!</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: History & Vitals */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <History className="h-5 w-5 text-gray-500" />
                            Patient History
                        </h3>
                        {currentPatient ? (
                            <div className="space-y-4">
                                {patientHistory.length > 0 ? (
                                    patientHistory.map((record, idx) => (
                                        <div key={idx} className="border-l-2 border-blue-200 pl-4 pb-4 last:pb-0">
                                            <div className="text-sm text-gray-500 mb-1">
                                                {new Date(record.scheduled_time).toLocaleDateString()}
                                            </div>
                                            <div className="font-medium text-gray-900">
                                                {record.consultation_notes || 'No notes recorded'}
                                            </div>
                                            <div className="text-sm text-gray-600 capitalize">
                                                Status: {record.status}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm italic">No previous history found.</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">Select a patient to view history.</p>
                        )}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-gray-500" />
                            Clinic Status
                        </h3>
                        <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <span className="text-gray-600">Active Hours</span>
                                <span className="font-medium">08:00 - 16:00</span>
                             </div>
                             {/* Add more stats if needed */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
};
