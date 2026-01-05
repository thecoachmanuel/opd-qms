import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getClinics, getQueueStatus, updateQueueStatus, getAppointmentById, getPatientHistory, SOCKET_URL } from '../services/api';
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

    // Update selected clinic if user's assigned clinic changes
    useEffect(() => {
        if (user?.clinic_id) {
            setSelectedClinic(user.clinic_id);
        }
    }, [user?.clinic_id]);
    const [patientDetails, setPatientDetails] = useState<any>(null);
    const [patientHistory, setPatientHistory] = useState<any[]>([]);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [socketClient, setSocketClient] = useState<any>(null);

    useEffect(() => {
        getClinics().then(setClinics);
    }, []);

    useEffect(() => {
        if (!selectedClinic) return;

        loadCurrentPatient();

        const socket = io(SOCKET_URL);
        setSocketClient(socket);
        
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.emit('join-clinic', selectedClinic);

        socket.on('queue-update', (data: any) => {
            // Find who is 'serving' - that's my patient
            const serving = data.queue.find((q: any) => q.status === 'serving');
            const waiting = data.queue.filter((q: any) => q.status === 'waiting');
            setCurrentPatient(serving);
            setWaitingQueue(waiting);
        });

        return () => {
            socket.disconnect();
        };
    }, [selectedClinic]);

    // Fetch details when current patient changes
    useEffect(() => {
        if (currentPatient && currentPatient.appointment_id) {
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

    const loadCurrentPatient = async () => {
        setLoading(true);
        const data = await getQueueStatus(selectedClinic);
        const serving = data.queue.find((q: any) => q.status === 'serving');
        const waiting = data.queue.filter((q: any) => q.status === 'waiting');
        setCurrentPatient(serving);
        setWaitingQueue(waiting);
        setLoading(false);
    };

    const handleCall = async (id: string) => {
        try {
            if (socketClient && selectedClinic) {
                socketClient.emit('doctor-call-next', { clinicId: selectedClinic, queueId: id });
            }
        } catch {
        }
    };

    const handleComplete = async () => {
        if (!currentPatient) return;
        try {
            await updateQueueStatus(currentPatient.id, 'done', selectedClinic, notes, user?.role as any, user?.id);
            setNotes('');
            setCurrentPatient(null);
            alert('Consultation Completed');
        } catch (err) {
            alert('Failed to complete');
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
                            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? "Server Connected" : "Disconnected"}></span>
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

                                    <button
                                        onClick={handleComplete}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="h-5 w-5" />
                                        Complete Consultation
                                    </button>
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
                                                <li key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl font-bold text-gray-900">{item.ticket_number}</span>
                                                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                                                {new Date(item.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-600">{item.patient_name || 'Walk-in Patient'}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleCall(item.id)}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm flex items-center gap-1 shadow-sm"
                                                    >
                                                        Call Now
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
