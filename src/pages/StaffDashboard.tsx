import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getClinics, getQueueStatus, checkIn, updateQueueStatus, deleteQueueItem } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mic, XCircle, RefreshCw, FileText } from 'lucide-react';

export const StaffDashboard: React.FC = () => {
    const { user } = useAuth();
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<string>(() => {
        return localStorage.getItem('staff_dashboard_selected_clinic') || user?.clinic_id || '';
    });
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Ref for optimization
    const queueStrRef = React.useRef<string>('');
    
    useEffect(() => {
        if (selectedClinic) {
            localStorage.setItem('staff_dashboard_selected_clinic', selectedClinic);
        }
    }, [selectedClinic]);
    
    

    // Check-in Form
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [checkInData, setCheckInData] = useState({ patientName: '' });
    const [generatedTicket, setGeneratedTicket] = useState<string | null>(null);

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
        if (user?.clinic_id) {
            setSelectedClinic(user.clinic_id);
        }
    }, [user?.clinic_id]);

    useEffect(() => {
        if (!selectedClinic) return;
        
        loadQueue();

        // Subscribe to real-time queue changes
        const channel = supabase
            .channel(`staff-dashboard-${selectedClinic}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'queue', filter: `clinic_id=eq.${selectedClinic}` },
                () => {
                    loadQueue(true);
                }
            )
            .subscribe();

        // Poll every 100ms for near-instant updates
        const interval = setInterval(() => loadQueue(true), 100);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [selectedClinic]);

    const loadQueue = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await getQueueStatus(selectedClinic);
            
            // Optimization: Only update if queue changed
            // We strip out dynamic fields if any, but usually queue items are stable enough
            // For checking changes, mapping IDs and status is usually enough + length
            const simpleQueue = data.queue.map((q: any) => ({id: q.id, status: q.status, doctor_id: q.doctor_id, ticket_number: q.ticket_number}));
            const newQueueStr = JSON.stringify(simpleQueue);
            
            if (newQueueStr !== queueStrRef.current) {
                queueStrRef.current = newQueueStr;
                setQueue(data.queue);
            }
        } catch (err) {
            console.warn("Failed to load queue", err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await checkIn({
                clinic_id: selectedClinic,
                patient_name: checkInData.patientName
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
            // We pass undefined for userId so we don't overwrite doctor_id with staff's ID.
            // Staff is just facilitating the queue, not necessarily the one 'serving' medically.
            await updateQueueStatus(id, status as any, selectedClinic, undefined, user?.role as any, undefined);
            loadQueue();
        } catch (err: any) {
            console.error('Update status failed:', err);
            alert('Failed to update status: ' + (err.message || JSON.stringify(err)));
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Are you sure you want to remove this patient from the queue?')) return;
        try {
            await deleteQueueItem(id);
            loadQueue();
        } catch (err: any) {
            console.error('Delete failed:', err);
            alert('Failed to remove from queue: ' + (err.message || JSON.stringify(err)));
        }
    };

    const waitingQueue = queue.filter(q => q.status === 'waiting');
    const servingQueue = queue.filter(q => q.status === 'serving');

    const ticketStyle = (id?: string) => {
        switch (id) {
            case '1':
                return 'text-green-700';
            case '2':
                return 'text-blue-700';
            case '3':
                return 'text-orange-700';
            case '4':
                return 'text-purple-700';
            default:
                return 'text-teal-700';
        }
    };

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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Staff Dashboard</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-gray-600">Clinic: <span className="font-semibold text-green-600">{clinics.find(c => c.id === selectedClinic)?.name}</span></p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                         <button 
                            onClick={() => loadQueue()}
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
                        {selectedClinic && (
                          <Link
                            to={`/display/${selectedClinic ? encodeURIComponent(clinics.find(c => c.id === selectedClinic)?.name || selectedClinic) : ''}`}
                            target="_blank"
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            aria-label="Open Assigned Clinic Display"
                          >
                            Open Clinic Display
                          </Link>
                        )}
                    </div>
                </div>

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
                                        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                                            <div>
                                                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Current Patient</span>
                                                <span className={`text-5xl font-bold block mt-1 ${ticketStyle(selectedClinic)}`}>{item.ticket_number}</span>
                                                <span className="text-lg text-gray-700 mt-2 block">{item.patient_name || 'Anonymous'}</span>
                                            </div>
                                            <div className="bg-white px-3 py-1 rounded-full text-sm font-medium text-green-800 border border-green-200 shadow-sm flex flex-col items-end w-full sm:w-auto">
                                                <span>In Consultation</span>
                                                {item.profiles?.full_name && (
                                                    <span className="text-xs text-gray-500 mt-1">w/ {item.profiles.full_name}</span>
                                                )}
                                                {!item.doctor_id && (
                                                    <span className="text-xs text-orange-500 mt-1 italic">Waiting for Doctor</span>
                                                )}
                                            </div>
                                        </div>
                                        
                        

                                        <div className="flex flex-wrap justify-end gap-3">
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'serving')}
                                                className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                                                title="Re-announce Ticket"
                                            >
                                                <Mic className="h-5 w-5 mr-2" />
                                                Call Again
                                            </button>
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
                                    <li key={item.id} className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-50 gap-4">
                                        <div>
                                            <span className={`text-xl font-bold block ${ticketStyle(selectedClinic)}`}>{item.ticket_number}</span>
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
                                                onClick={() => handleCancel(item.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500"
                                                title="Cancel (Remove from Queue)"
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
