import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getQueueStatus, getClinics } from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Activity } from 'lucide-react';
import { Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { soundManager } from '../utils/sound';

export const QueueDisplay: React.FC = () => {
    const { config } = useSiteSettings();
    const { clinicId: paramClinicId } = useParams<{ clinicId: string }>();
    const [resolvedClinicId, setResolvedClinicId] = useState<string | null>(null);
    const [queue, setQueue] = useState<any[]>([]);
    // Use Ref to keep track of queue state inside callbacks without dependency issues
    const queueRef = React.useRef<any[]>([]);
    
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const [clinicName, setClinicName] = useState('Loading...');
    const [clinicLocation, setClinicLocation] = useState('');
    const [themeColor, setThemeColor] = useState('#10B981');
    // Use Ref to track last announced details to avoid stale state in callbacks/effects
    const lastAnnouncedRef = React.useRef<{ id: string, service_start_time: string } | null>(null);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [isConnected, setIsConnected] = useState(false); // Used to show connection status
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);

    // Clock Tick
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const initAudio = async () => {
        await soundManager.initAudio();
        setAudioEnabled(true);
        soundManager.playBeep();
        soundManager.speak("Audio Enabled");
    };

    const announceTicket = (ticket: string, location: string, patientName?: string) => {
        if (!audioEnabled) return;
        soundManager.playBeep();
        
        // Slight delay for beep to register before speech
        setTimeout(() => {
            let msg = `Ticket ${ticket}`;
            // Ensure patientName is a valid string and not just whitespace
            if (patientName && typeof patientName === 'string' && patientName.trim() !== '') {
                // Add a pause (period) before the name for better TTS pacing
                msg += `. ${patientName}`;
            }
            msg += `. Please proceed to ${location}`;
            
            console.log('Announcing:', msg); // Debug log
            soundManager.speak(msg);
        }, 500);
    };

    // Resolve Clinic ID/Name
    useEffect(() => {
        const resolveClinic = async () => {
             if (!paramClinicId) return;
             try {
                 const clinics = await getClinics();
                 // Try ID match first
                 let match = clinics.find((c: any) => c.id === paramClinicId);
                 // If not found, try name match (case-insensitive)
                 if (!match) {
                     match = clinics.find((c: any) => c.name.toLowerCase() === paramClinicId.toLowerCase());
                 }
                 
                 if (match) {
                     setResolvedClinicId(match.id);
                     setClinicName(match.name);
                     setClinicLocation(match.location);
                     if (match.theme_color) {
                         setThemeColor(match.theme_color);
                     }
                 } else {
                     setClinicName('Clinic Not Found');
                     setResolvedClinicId(null);
                 }
             } catch (e) {
                 console.error(e);
                 setClinicName('Error Loading Clinic');
             }
        };
        resolveClinic();
    }, [paramClinicId]);

    // Initial Data Load
    useEffect(() => {
        const fetchInitialData = async () => {
            if (resolvedClinicId) {
                try {
                    // 2. Get Queue
                    const status = await getQueueStatus(resolvedClinicId);
                    setQueue(status.queue);
                    setIsConnected(true);
                } catch (err) {
                    console.error("Failed to load queue data", err);
                }
            }
        };

        fetchInitialData();
    }, [resolvedClinicId]);

    // Polling Backup to ensure instant updates even if Realtime misses an event
    useEffect(() => {
        if (!resolvedClinicId) return;

        const loadData = async () => {
            try {
                const status = await getQueueStatus(resolvedClinicId);
                setQueue(status.queue);
                setIsConnected(true);
                setLastUpdated(new Date().toLocaleTimeString());
                
                // Check for new serving ticket to announce (if polling catches it before realtime)
                const newServing = status.queue.find((q: any) => q.status === 'serving');
                if (newServing) {
                    const isNew = newServing.id !== lastAnnouncedRef.current?.id;
                    const isCallAgain = !isNew && newServing.service_start_time !== lastAnnouncedRef.current?.service_start_time;
                    
                    if (isNew || isCallAgain) {
                        lastAnnouncedRef.current = { id: newServing.id, service_start_time: newServing.service_start_time };
                        announceTicket(newServing.ticket_number, clinicLocation || 'Room 1', newServing.patient_name);
                    }
                }
            } catch (err) {
                console.warn('Polling failed:', err);
            }
        };

        // Poll every 100ms for near-instant updates
        const interval = setInterval(loadData, 100);
        return () => clearInterval(interval);
    }, [resolvedClinicId, clinicLocation, audioEnabled]);

    // Supabase Realtime Subscription
    useEffect(() => {
        if (!resolvedClinicId) return;

        const channel = supabase
            .channel('queue-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'queue',
                    filter: `clinic_id=eq.${resolvedClinicId}`
                },
                (payload) => {
                    // Handle different events
                    if (payload.eventType === 'INSERT') {
                        setQueue(prev => [...prev, payload.new]);
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new;
                        
                        // Merge with existing data to ensure we have all fields (like patient_name)
                        // This handles cases where Supabase sends partial updates (only changed fields)
                        const existing = queueRef.current.find(q => q.id === updated.id) || {};
                        const merged = { ...existing, ...updated };

                        setQueue(prev => prev.map(q => q.id === updated.id ? merged : q));
                        
                        // Check for status change to 'serving' to trigger announcement
                        // OR if it's already serving but service_start_time changed (Call Again)
                        const isServing = merged.status === 'serving';
                        // Note: We use merged.service_start_time vs ref
                        const isNewServing = isServing && merged.id !== lastAnnouncedRef.current?.id;
                        const isCallAgain = isServing && merged.id === lastAnnouncedRef.current?.id && merged.service_start_time !== lastAnnouncedRef.current?.service_start_time;

                        if (isNewServing || isCallAgain) {
                            lastAnnouncedRef.current = { id: merged.id, service_start_time: merged.service_start_time };
                            // Need clinic location, assuming we have it in state
                            announceTicket(merged.ticket_number, clinicLocation || 'Room 1', merged.patient_name);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setQueue(prev => prev.filter(q => q.id !== payload.old.id));
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setIsConnected(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    setIsConnected(false);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [resolvedClinicId, clinicLocation, audioEnabled]); // Dependencies for closure values

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (e) {}
    };

    const serving = queue.find(q => q.status === 'serving');
    const waiting = queue.filter(q => q.status === 'waiting').slice(0, 5); // Show next 5

    return (
        <div className="h-screen bg-gray-900 text-white p-2 md:p-6 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none flex flex-col md:flex-row justify-between items-center border-b border-gray-700 pb-4 mb-4 gap-2 md:gap-0">
                <div className="flex items-center gap-3">
                    {config.header.logo_url ? (
                        <img src={config.header.logo_url} alt={config.header.site_name} className="h-8 md:h-10 w-auto object-contain" />
                    ) : (
                        <Activity className="h-6 w-6 md:h-8 md:w-8 text-green-500" />
                    )}
                    <span className="text-lg md:text-xl font-bold text-white">{config.header.site_name}</span>
                </div>
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <h1 className="text-xl md:text-4xl font-bold" style={{ color: themeColor }}>{clinicName}</h1>
                    <div className="flex items-center gap-2 mt-1 md:mt-2">
                        <span className="text-gray-400 text-xs md:text-base">{clinicLocation}</span>
                        <span className={`h-2 w-2 md:h-3 md:w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? "Live Connected" : "Disconnected"}></span>
                        {lastUpdated && <span className="text-[10px] md:text-xs text-gray-500">Updated: {lastUpdated}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button 
                        onClick={audioEnabled ? () => setAudioEnabled(false) : initAudio}
                        className={`p-2 md:p-3 rounded-full transition-colors ${audioEnabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}
                        title={audioEnabled ? "Mute Audio" : "Enable Audio"}
                    >
                        {audioEnabled ? <Volume2 className="h-4 w-4 md:h-6 md:w-6" /> : <VolumeX className="h-4 w-4 md:h-6 md:w-6" />}
                    </button>

                    <div className="text-lg md:text-2xl text-gray-400 font-mono">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 md:p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="h-4 w-4 md:h-6 md:w-6" /> : <Maximize className="h-4 w-4 md:h-6 md:w-6" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                {/* NOW SERVING - MAIN FOCUS */}
                <div className={`bg-gray-800 rounded-2xl md:rounded-3xl p-4 md:p-12 flex flex-col items-center justify-center h-full overflow-hidden`} style={{ border: `4px solid ${themeColor}`, boxShadow: `0 0 50px ${themeColor}4D` }}>
                    <h2 className="text-2xl md:text-4xl font-light text-gray-400 uppercase tracking-widest mb-4 md:mb-8 text-center">Now Serving</h2>
                    
                    {serving ? (
                        <div className="text-center animate-pulse flex flex-col items-center justify-center flex-1">
                            <div className={`text-7xl md:text-9xl lg:text-[10rem] xl:text-[12rem] font-black leading-none tracking-tighter`} style={{ color: themeColor }}>
                                {serving.ticket_number}
                            </div>
                            <div className="text-xl md:text-4xl mt-4 font-medium break-words max-w-full px-4" style={{ color: themeColor }}>
                                {serving.patient_name || 'Please Proceed to Room'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center flex flex-col items-center justify-center flex-1">
                            <div className="text-4xl md:text-6xl font-bold text-gray-600">
                                -- --
                            </div>
                            <div className="text-xl md:text-2xl text-gray-500 mt-4">
                                Please Wait
                            </div>
                        </div>
                    )}
                </div>

                {/* UP NEXT LIST */}
                <div className="bg-gray-800 rounded-2xl md:rounded-3xl p-4 md:p-8 border border-gray-700 flex flex-col h-full overflow-hidden">
                    <h2 className="text-xl md:text-3xl font-light text-gray-400 uppercase tracking-widest mb-4 md:mb-8 pl-4 border-l-4 flex-none" style={{ borderColor: themeColor }}>Up Next</h2>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 md:space-y-4 pr-2">
                        {waiting.length > 0 ? (
                            waiting.map((item, index) => (
                                <div key={item.id} className="flex justify-between items-center bg-gray-700 p-3 md:p-6 rounded-xl">
                                    <div className="flex items-center">
                                        <span className="text-gray-500 font-mono text-base md:text-xl w-8 md:w-12">#{index + 1}</span>
                                        <span className={`text-2xl md:text-4xl font-bold`} style={{ color: themeColor }}>{item.ticket_number}</span>
                                    </div>
                                    <span className="text-sm md:text-xl text-gray-300">
                                        Wait: ~{index * 15} min
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500 text-lg md:text-xl">
                                No patients waiting
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
