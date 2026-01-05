import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getClinics, getQueueStatus, checkIn, updateQueueStatus, SOCKET_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mic, XCircle, RefreshCw, FileText } from 'lucide-react';

export const StaffDashboard: React.FC = () => {
    const { user } = useAuth();
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<string>(() => {
        return localStorage.getItem('staff_dashboard_selected_clinic') || user?.clinic_id || '';
    });
    const [queue, setQueue] = useState<any[]>([]);
    const [callRequest, setCallRequest] = useState<{ queueId: string; clinicId: string; timestamp: number } | null>(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (selectedClinic) {
            localStorage.setItem('staff_dashboard_selected_clinic', selectedClinic);
        }
    }, [selectedClinic]);
    
    // Update selected clinic if user's assigned clinic changes
    useEffect(() => {
        if (user?.clinic_id) {
            setSelectedClinic(user.clinic_id);
        }
    }, [user?.clinic_id]);
    
    

    // Check-in Form
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [checkInData, setCheckInData] = useState({ patientName: '' });
    const [generatedTicket, setGeneratedTicket] = useState<string | null>(null);
    
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        setLoading(true);
        getClinics()
            .then(data => {
                console.log('Clinics loaded:', data);
                setClinics(data);
            })
            .catch(err => {
                console.error('Failed to load clinics:', err);
                alert('Failed to load clinics. Please check server connection.');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedClinic) return;
        
        loadQueue();

        const socket = io(SOCKET_URL);
        
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.emit('join-clinic', selectedClinic);

        socket.on('queue-update', (data: any) => {
            setQueue(data.queue);
        });

        socket.on('staff-call-request', (payload: any) => {
            setCallRequest(payload);
        });

        return () => {
            socket.disconnect();
        };
    }, [selectedClinic]);

    const loadQueue = async () => {
        setLoading(true);
        try {
            const data = await getQueueStatus(selectedClinic);
            setQueue(data.queue);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await checkIn({
                clinicId: selectedClinic,
                patientName: checkInData.patientName
            });
            setGeneratedTicket(result.ticket_number);
            setCheckInData({ patientName: '' });
            loadQueue();
            
            // Close after 3 seconds
            setTimeout(() => {
                setGeneratedTicket(null);
                setShowCheckIn(false);
            }, 3000);
        } catch (err) {
            alert('Failed to check in');
        }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await updateQueueStatus(id, status as any, selectedClinic, undefined, user?.role as any, user?.id);
            loadQueue();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const waitingQueue = queue.filter(q => q.status === 'waiting');
    const servingQueue = queue.filter(q => q.status === 'serving');

    if (!selectedClinic) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Select Clinic</h2>
                    
                    {loading ? (
                         <div className="flex justify-center mb-4">
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                         </div>
                    ) : (
                        <select
                            className="block w-full p-3 border border-gray-300 rounded-md focus:ring-green-600 focus:border-green-600"
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
                        <h1 className="text-3xl font-bold text-gray-800">Staff Dashboard</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-gray-600">Clinic: <span className="font-semibold text-green-600">{clinics.find(c => c.id === selectedClinic)?.name}</span></p>
                            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? "Server Connected" : "Disconnected"}></span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                         <button 
                            onClick={loadQueue}
                            className="p-2 text-gray-600 hover:text-primary rounded-full hover:bg-gray-100"
                        >
                            <RefreshCw className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button 
                            onClick={() => setShowCheckIn(true)}
                            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                        >
                            <UserPlus className="h-5 w-5 mr-2" />
                            Walk-in Check-in
                        </button>
                    </div>
                </div>

                {callRequest && callRequest.clinicId === selectedClinic && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                        <div className="text-sm text-blue-900">
                            <span className="font-semibold">Doctor request:</span> Call next patient
                            {(() => { const item = queue.find((q:any)=>q.id===callRequest.queueId); return item ? ` • Ticket ${item.ticket_number}` : '' })()}
                        </div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={async()=>{ await handleStatusChange(callRequest.queueId, 'serving'); setCallRequest(null); }}>Call Now</button>
                            <button className="px-3 py-1 border rounded" onClick={()=>setCallRequest(null)}>Dismiss</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Active Serving */}
                    <div className="lg:col-span-2 space-y-6">
                         <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                                <FileText className="h-5 w-5 mr-2 text-green-600" />
                                Doctor's Consultation Panel
                            </h3>
                            
                            {servingQueue.length > 0 ? (
                                servingQueue.map(item => (
                                    <div key={item.id} className="bg-green-50 p-6 rounded-md">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Current Patient</span>
                                                <span className="text-5xl font-bold text-gray-900 block mt-1">{item.ticket_number}</span>
                                                <span className="text-lg text-gray-700 mt-2 block">{item.patient_name || 'Anonymous'}</span>
                                            </div>
                                            <div className="bg-white px-3 py-1 rounded-full text-sm font-medium text-green-800 border border-green-200 shadow-sm">
                                                In Consultation
                                            </div>
                                        </div>
                                        
                        

                                        <div className="flex justify-end space-x-3">
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'no_show')}
                                                className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                                            >
                                                <XCircle className="h-5 w-5 mr-2" />
                                                No Show
                                            </button>
                                            
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-md border-2 border-dashed border-gray-200">
                                    <UserPlus className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                    <p className="text-lg font-medium text-gray-900">No Active Consultation</p>
                                    <p className="text-sm text-gray-500">Call a patient from the waiting list to start.</p>
                                </div>
                            )}
                        </div>

                        {/* Waiting List */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900">Waiting List ({waitingQueue.length})</h3>
                            </div>
                            <ul className="divide-y divide-gray-200">
                                {waitingQueue.map((item) => (
                                    <li key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                        <div>
                                            <span className="text-xl font-bold text-gray-900 block">{item.ticket_number}</span>
                                            <span className="text-sm text-gray-500">{item.patient_name || 'Anonymous'}</span>
                                            <span className="text-xs text-gray-400 ml-2">Arrived: {new Date(item.arrival_time).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => handleStatusChange(item.id, 'serving')}
                                                className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                            >
                                                <Mic className="h-4 w-4 mr-1" />
                                                Call
                                            </button>
                                            <button 
                                                onClick={() => handleStatusChange(item.id, 'no_show')}
                                                className="p-1.5 text-gray-400 hover:text-red-500"
                                                title="Mark as No Show"
                                            >
                                                <XCircle className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                                {waitingQueue.length === 0 && (
                                    <li className="px-6 py-8 text-center text-gray-500">
                                        Queue is empty.
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Stats Sidebar (Optional) */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Session Stats</h3>
                            <dl className="grid grid-cols-1 gap-4">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Total Served</dt>
                                    <dd className="text-2xl font-bold text-gray-900">{queue.filter(q => q.status === 'done').length}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            {/* Check-in Modal */}
            {showCheckIn && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Walk-In Check-in</h3>
                        
                        {generatedTicket ? (
                            <div className="text-center py-8">
                                <p className="text-gray-600 mb-2">Ticket Generated Successfully</p>
                                <div className="text-5xl font-bold text-green-600 mb-4">{generatedTicket}</div>
                                <p className="text-sm text-gray-500">Closing shortly...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleCheckIn} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Patient Name</label>
                                    <input 
                                        type="text" 
                                        autoFocus
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                                        value={checkInData.patientName}
                                        onChange={e => setCheckInData({...checkInData, patientName: e.target.value})}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="flex justify-end space-x-3 mt-6">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCheckIn(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                                    >
                                        Check In
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
