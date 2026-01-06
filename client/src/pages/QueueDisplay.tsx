import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getQueueStatus, getClinics, SOCKET_URL } from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Activity } from 'lucide-react';
import { Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

export const QueueDisplay: React.FC = () => {
    const { config } = useSiteSettings();
    const { clinicId } = useParams<{ clinicId: string }>();
    const [queue, setQueue] = useState<any[]>([]);
    const [clinicName, setClinicName] = useState('Loading...');
    const [clinicLocation, setClinicLocation] = useState('');
    const [lastServingId, setLastServingId] = useState<string | null>(null);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdated] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
    const ticketStyle = (id?: string) => {
        switch (id) {
            case '1':
                return {
                    text: 'text-green-400',
                    borderGlow: 'border-4 border-green-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]'
                };
            case '2':
                return {
                    text: 'text-blue-400',
                    borderGlow: 'border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)]'
                };
            case '3':
                return {
                    text: 'text-orange-400',
                    borderGlow: 'border-4 border-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.3)]'
                };
            case '4':
                return {
                    text: 'text-purple-400',
                    borderGlow: 'border-4 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.3)]'
                };
            default:
                return {
                    text: 'text-teal-400',
                    borderGlow: 'border-4 border-teal-500 shadow-[0_0_50px_rgba(13,148,136,0.3)]'
                };
        }
    };
    const audioContextRef = useRef<AudioContext | null>(null);
    const ttsTimersRef = useRef<number[]>([]);
    const announcementCountRef = useRef<number>(0);
    const ttsIntervalRef = useRef<number | null>(null);

    // Initialize Audio Context on user interaction
    const initAudio = () => {
        // 1. Resume Audio Context
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        
        setAudioEnabled(true);

        // 2. Play Test Sound & Unlock TTS immediately
        playBeep();
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance("Audio Enabled");
            window.speechSynthesis.speak(utterance);
        }
    };

    // Play a generated beep sound
    const playBeep = () => {
        if (!audioContextRef.current) return;
        
        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
    };

    
    // Audio for announcements
    const announceTicket = (ticket: string, location: string, patientName?: string) => {
        if (!audioEnabled) return;

        // 1. Play Beep
        try {
            playBeep();
        } catch (e) {
            console.error('Audio play failed:', e);
        }

        // 2. Speech Synthesis
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            // Construct announcement text
            const namePart = patientName && patientName !== 'Walk-in Patient' ? `${patientName}` : 'the next patient';
            const locationPart = location || 'the clinic';
            const text = `Attention please. Ticket ${ticket}, ${namePart}. Please proceed to ${locationPart}. Thank you.`;

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            utterance.pitch = 1;
            
            // Ensure we use a voice if available (fixes some browser issues)
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            }

            window.speechSynthesis.speak(utterance);
        }
    };

    const scheduleAnnouncements = (ticket: string, location: string, patientName?: string, id?: string) => {
        ttsTimersRef.current.forEach(t => clearTimeout(t));
        ttsTimersRef.current = [];
        if (ttsIntervalRef.current) {
            clearInterval(ttsIntervalRef.current);
            ttsIntervalRef.current = null;
        }
        announcementCountRef.current = 0;
        announceTicket(ticket, location, patientName);
        announcementCountRef.current = 1;
        ttsIntervalRef.current = window.setInterval(() => {
            if (id && lastServingId !== id) return;
            if (!audioEnabled) return;
            announceTicket(ticket, location, patientName);
        }, 15000);
    };

    useEffect(() => {
        if (!clinicId) return;

        // Fetch Initial Name & Location
        getClinics().then(clinics => {
            const c = clinics.find((cl: any) => cl.id === clinicId);
            if (c) {
                setClinicName(c.name);
                setClinicLocation(c.location || 'Room 1');
            }
        });

        loadQueue();

        const socket = io(SOCKET_URL);
        
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.emit('join-clinic', clinicId);

        socket.on('queue-update', (data: any) => {
            setQueue(data.queue);
        });

        return () => {
            socket.disconnect();
        };
    }, [clinicId]);

    useEffect(() => {
        return () => {
            ttsTimersRef.current.forEach(t => clearTimeout(t));
            ttsTimersRef.current = [];
            if (ttsIntervalRef.current) {
                clearInterval(ttsIntervalRef.current);
                ttsIntervalRef.current = null;
            }
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        };
    }, []);

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

    // Effect to handle announcements when queue changes
    useEffect(() => {
        const serving = queue.find(q => q.status === 'serving');
        
        // If we have a serving patient, and it's different from the last one we announced
        if (serving && serving.id !== lastServingId) {
            setLastServingId(serving.id);
            scheduleAnnouncements(serving.ticket_number, clinicLocation, serving.patient_name, serving.id);
        }
    }, [queue, clinicLocation, lastServingId, audioEnabled]); // Dependencies

    const loadQueue = async () => {
        if (!clinicId) return;
        const data = await getQueueStatus(clinicId);
        setQueue(data.queue);
        // Initial load: don't announce, just sync state
        const serving = data.queue.find((q: any) => q.status === 'serving');
        if (serving) setLastServingId(serving.id);
    };

    const serving = queue.find(q => q.status === 'serving');
    const waiting = queue.filter(q => q.status === 'waiting').slice(0, 5); // Show next 5

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-700 pb-6 mb-8 gap-4 md:gap-0">
                <div className="flex items-center gap-3">
                    {config.header.logo_url ? (
                        <img src={config.header.logo_url} alt={config.header.site_name} className="h-10 w-auto object-contain" />
                    ) : (
                        <Activity className="h-8 w-8 text-green-500" />
                    )}
                    <span className="text-xl font-bold text-white">{config.header.site_name}</span>
                </div>
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <h1 className="text-2xl md:text-4xl font-bold text-green-400">{clinicName}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-gray-400 text-sm md:text-base">{clinicLocation}</span>
                        <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? "Live Connected" : "Disconnected"}></span>
                        {lastUpdated && <span className="text-xs text-gray-500">Updated: {lastUpdated}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={audioEnabled ? () => setAudioEnabled(false) : initAudio}
                        className={`p-3 rounded-full transition-colors ${audioEnabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}
                        title={audioEnabled ? "Mute Audio" : "Enable Audio"}
                    >
                        {audioEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                    </button>

                    <div className="text-xl md:text-2xl text-gray-400 font-mono">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    
                    <button
                        onClick={toggleFullscreen}
                        className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* NOW SERVING - MAIN FOCUS */}
                <div className={`bg-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center ${ticketStyle(clinicId).borderGlow}`}>
                    <h2 className="text-4xl font-light text-gray-400 uppercase tracking-widest mb-8">Now Serving</h2>
                    
                    {serving ? (
                        <div className="text-center animate-pulse">
                            <div className={`text-[12rem] font-black leading-none tracking-tighter ${ticketStyle(clinicId).text}`}>
                                {serving.ticket_number}
                            </div>
                            <div className="text-4xl text-green-400 mt-4 font-medium">
                                {serving.patient_name || 'Please Proceed to Room'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="text-6xl font-bold text-gray-600">
                                -- --
                            </div>
                            <div className="text-2xl text-gray-500 mt-4">
                                Please Wait
                            </div>
                        </div>
                    )}
                </div>

                {/* UP NEXT LIST */}
                <div className="bg-gray-800 rounded-3xl p-8 border border-gray-700">
                    <h2 className="text-3xl font-light text-gray-400 uppercase tracking-widest mb-8 pl-4 border-l-4 border-blue-500">Up Next</h2>
                    
                    <div className="space-y-4">
                        {waiting.length > 0 ? (
                            waiting.map((item, index) => (
                                <div key={item.id} className="flex justify-between items-center bg-gray-700 p-6 rounded-xl">
                                    <div className="flex items-center">
                                        <span className="text-gray-500 font-mono text-xl w-12">#{index + 1}</span>
                                        <span className={`text-4xl font-bold ${ticketStyle(clinicId).text}`}>{item.ticket_number}</span>
                                    </div>
                                    <span className="text-xl text-gray-300">
                                        Wait: ~{index * 15} min
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500 text-xl">
                                No patients waiting
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-gray-500 text-lg">
                Please have your ticket number ready.
            </div>
        </div>
    );
};
