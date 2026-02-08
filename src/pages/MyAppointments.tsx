import React, { useState } from 'react';
import { searchAppointments, cancelAppointment } from '../services/api';
import { Search, Calendar, Clock, User, AlertCircle, XCircle } from 'lucide-react';

export const MyAppointments: React.FC = () => {
    const [query, setQuery] = useState('');
    const [appointments, setAppointments] = useState<any[]>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            // Auto-detect search type
            // Ticket codes usually contain letters (e.g. W-001, APP-123)
            // Phone numbers are numeric (maybe with +, -, space)
            const hasLetters = /[a-zA-Z]/.test(query);
            const searchType = hasLetters ? 'ticket' : 'phone';
            
            // If searching by phone, maybe strip non-digits for better matching if backend expects clean numbers?
            // For now, we'll pass as is since api uses ilike
            
            const data = await searchAppointments(searchType, query);
            setAppointments(data);
            setSearched(true);
        } catch (err) {
            console.error('Search failed', err);
            setAppointments([]);
            setSearched(true);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
        
        setCancelling(id);
        try {
            await cancelAppointment(id);
            // Refresh list locally
            setAppointments(prev => prev.map(a => 
                a.id === id ? { ...a, status: 'cancelled' } : a
            ));
        } catch (err) {
            alert('Failed to cancel appointment');
        } finally {
            setCancelling(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900">My Appointments</h1>
                    <p className="mt-2 text-gray-600">Find your upcoming appointments by Phone Number or Ticket Code.</p>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                    placeholder="Enter Ticket Code or Phone Number..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </form>
                </div>

                {searched && (
                    <div className="space-y-6">
                        {appointments.length > 0 ? (
                            appointments.map((apt) => (
                                <div key={apt.id} className="bg-white shadow rounded-lg overflow-hidden border-l-4 border-green-500">
                                    <div className="px-6 py-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center">
                                                <div className="bg-green-100 rounded-full p-2 mr-3">
                                                    <Calendar className="h-6 w-6 text-green-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-medium text-gray-900">{apt.clinic_name || 'Clinic Visit'}</h3>
                                                    <p className="text-sm text-gray-500">Ticket: <span className="font-bold text-gray-900">{apt.ticket_code}</span></p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium 
                                                ${apt.status === 'booked' ? 'bg-blue-100 text-blue-800' : 
                                                  apt.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                                  apt.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {apt.status.toUpperCase()}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                                            <div className="flex items-center">
                                                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                                                {new Date(apt.scheduled_time).toLocaleString()}
                                            </div>
                                            <div className="flex items-center">
                                                <User className="h-4 w-4 mr-2 text-gray-400" />
                                                {apt.patient?.full_name}
                                            </div>
                                        </div>

                                        {apt.consultation_notes && (
                                            <div className="mt-4 p-3 bg-gray-50 rounded text-sm border border-gray-100">
                                                <span className="font-medium text-gray-700">Doctor's Notes:</span>
                                                <p className="mt-1 text-gray-600">{apt.consultation_notes}</p>
                                            </div>
                                        )}
                                        
                                        {apt.status === 'booked' && (
                                            <div className="mt-4 flex justify-end">
                                                <button
                                                    onClick={() => handleCancel(apt.id)}
                                                    disabled={cancelling === apt.id}
                                                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                                >
                                                    {cancelling === apt.id ? 'Cancelling...' : (
                                                        <>
                                                            <XCircle className="h-4 w-4 mr-2" />
                                                            Cancel Appointment
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
                                <p className="mt-1 text-sm text-gray-500">Check your details and try again.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
