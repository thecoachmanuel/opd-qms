import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getClinics, getQueueStatus } from '../services/api';
import { useParams, useSearchParams } from 'react-router-dom';
import { Clock, Users, Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface QueueStats {
    queue: any[];
    currentServing: any;
    totalWaiting: number;
    waitTime: number;
}

export const QueueStatus: React.FC = () => {
    const { clinicId } = useParams<{ clinicId: string }>();
    const [searchParams] = useSearchParams();
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<string>('');
    const [myTicket, setMyTicket] = useState<string>('');
    const [stats, setStats] = useState<QueueStats | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const prevStatusRef = useRef<string | null>(null);
    const prevPositionRef = useRef<number | null>(null);
    const prevServingRef = useRef<string | null>(null);

    const toggleMute = async () => {
        if (isMuted) {
            // User is unmuting
            await soundManager.initAudio();
            soundManager.speak("Voice updates enabled");
        }
        setIsMuted(!isMuted);
    };

    const announce = (text: string) => {
        if (isMuted) return;
        soundManager.speak(text);
    };

    useEffect(() => {
        if (!stats) return;

        // General Announcement: New Ticket Serving
        const currentTicket = stats.currentServing?.ticket_number;
        if (currentTicket && prevServingRef.current !== currentTicket) {
             if (myTicket !== currentTicket) {
                 announce(`Now serving ticket number ${currentTicket}`);
             }
        }
        prevServingRef.current = currentTicket || null;

        // Personal Announcements
        if (myTicket) {
            const myEntry = stats.queue.find((q: any) => q.ticket_number === myTicket);
            const waitingList = stats.queue.filter((q: any) => q.status === 'waiting');
            const myPos = myEntry && myEntry.status === 'waiting' 
                ? waitingList.findIndex((q: any) => q.ticket_number === myTicket) + 1 
                : null;

            if (myEntry) {
                // Status Change: Waiting -> Serving
                if (prevStatusRef.current === 'waiting' && myEntry.status === 'serving') {
                    announce(`Attention please. Ticket number ${myTicket}, it is your turn. Please proceed to the clinic.`);
                }
                
                // Position Change: Becomes 1st
                if (myPos === 1 && prevPositionRef.current !== 1) {
                    announce(`Ticket number ${myTicket}, you are next in line.`);
                }
                
                prevStatusRef.current = myEntry.status;
                prevPositionRef.current = myPos;
            }
        }
    }, [stats, myTicket, isMuted]);

    useEffect(() => {
        getClinics()
            .then(data => {
                console.log('Clinics loaded:', data);
                setClinics(data);
            })
            .catch(err => {
                console.error('Failed to load clinics:', err);
                alert('Failed to load clinics. Please check server connection.');
            });
    }, []);

    useEffect(() => {
        if (clinicId) {
            setSelectedClinic(clinicId);
        }
        const t = searchParams.get('ticket');
        if (t) setMyTicket(t);
    }, [clinicId, searchParams]);

    const loadQueueStats = async () => {
        const data = await getQueueStatus(selectedClinic);
        setStats(data);
    };

    useEffect(() => {
        if (!selectedClinic) return;

        // Initial Load
        loadQueueStats();

        // Subscribe to real-time queue changes
        const channel = supabase
            .channel(`queue-status-${selectedClinic}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'queue', filter: `clinic_id=eq.${selectedClinic}` },
                () => {
                    loadQueueStats();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedClinic]);

    const myEntry = stats?.queue.find((q: any) => q.ticket_number === myTicket);
    const waitingList = stats?.queue.filter((q: any) => q.status === 'waiting') || [];
    const myPosition = myEntry && myEntry.status === 'waiting' ? waitingList.findIndex((q: any) => q.ticket_number === myTicket) + 1 : null;
    const myWaitMins = myPosition ? myPosition * 15 : 0;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12 relative">
                    <button
                        onClick={toggleMute}
                        className="absolute right-0 top-0 p-2 rounded-full bg-white shadow-sm border border-gray-200 hover:bg-gray-50 focus:outline-none"
                        title={isMuted ? "Unmute Voice Updates" : "Mute Voice Updates"}
                    >
                        {isMuted ? <VolumeX className="h-6 w-6 text-gray-400" /> : <Volume2 className="h-6 w-6 text-green-600" />}
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                        Real-Time Queue Status
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
                        Select a clinic to view live waiting times and current serving numbers.
                    </p>
                </div>

                {/* Clinic Selector */}
                <div className="max-w-xs mx-auto mb-12">
                    <select
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-600 focus:border-green-600 sm:text-sm rounded-md border"
                        value={selectedClinic}
                        onChange={(e) => setSelectedClinic(e.target.value)}
                    >
                        <option value="">-- Select Clinic --</option>
                        {clinics.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {selectedClinic && stats ? (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {myTicket && (
                            <div className="bg-green-50 overflow-hidden shadow rounded-lg border border-green-200 lg:col-span-2">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <dt className="text-sm font-medium text-green-700 truncate uppercase tracking-wider">Your Ticket</dt>
                                            <dd className="mt-1 text-4xl font-extrabold text-green-600">{myTicket}</dd>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-green-700">
                                                {myEntry ? (myEntry.status === 'serving' ? 'Now Serving' : 'Waiting') : 'Not found'}
                                            </div>
                                            {myPosition && (
                                                <div className="text-sm text-green-700">Position: #{myPosition} • Est. {myWaitMins} mins</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Current Serving Card */}
                        <div className="bg-white overflow-hidden shadow rounded-lg border-t-4 border-green-500">
                            <div className="px-4 py-5 sm:p-6 text-center">
                                <dt className="text-sm font-medium text-gray-500 truncate uppercase tracking-wider">
                                    Now Serving
                                </dt>
                                <dd className="mt-1 text-6xl font-extrabold text-gray-900">
                                    {stats.currentServing ? stats.currentServing.ticket_number : '--'}
                                </dd>
                                <p className="mt-2 text-sm text-gray-600">
                                    {stats.currentServing ? `Patient: ${stats.currentServing.patient_name || 'Anonymous'}` : 'Counter Closed'}
                                </p>
                            </div>
                        </div>

                        {/* Waiting Stats */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dt className="text-sm font-medium text-gray-500 truncate">
                                                People Waiting
                                            </dt>
                                            <dd className="flex items-baseline">
                                                <div className="text-2xl font-semibold text-gray-900">
                                                    {stats.totalWaiting}
                                                </div>
                                            </dd>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 bg-amber-500 rounded-md p-3">
                                            <Clock className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dt className="text-sm font-medium text-gray-500 truncate">
                                                Est. Wait Time
                                            </dt>
                                            <dd className="flex items-baseline">
                                                <div className="text-2xl font-semibold text-gray-900">
                                                    {stats.waitTime} <span className="text-sm font-normal text-gray-500">mins</span>
                                                </div>
                                            </dd>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Queue List */}
                        <div className="bg-white shadow overflow-hidden sm:rounded-lg lg:col-span-2">
                            <div className="px-4 py-5 sm:px-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Up Next
                                </h3>
                            </div>
                            <ul className="divide-y divide-gray-200">
                                {stats.queue.filter(q => q.status === 'waiting').map((entry, idx) => (
                                    <li key={entry.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <span className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm mr-4">
                                                    {idx + 1}
                                                </span>
                                                <p className="text-sm font-medium text-primary truncate">
                                                    {entry.ticket_number}
                                                </p>
                                            </div>
                                            <div className="flex flex-shrink-0">
                                                <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    Waiting
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                                {stats.queue.filter(q => q.status === 'waiting').length === 0 && (
                                    <li className="px-4 py-8 text-center text-gray-500">
                                        No one is currently waiting.
                                    </li>
                                )}
                            </ul>
                        </div>

                    </div>
                ) : (
                    selectedClinic && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Loading queue data...</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
