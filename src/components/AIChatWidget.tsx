import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, User, Loader, MapPin, Clock, CheckCircle } from 'lucide-react';
import { getClinics, getSlots, bookAppointment, searchAppointments, adminCreateClinic, adminGetUsers, adminApproveUser, getQueueStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { analyzeMedicalQuery } from '../utils/medicalKnowledge';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  type?: 'text' | 'options' | 'input' | 'clinic-list' | 'slot-list';
  options?: { label: string; value: string }[];
  data?: any;
}

interface BookingState {
  step: 'none' | 'name' | 'phone' | 'clinic' | 'date' | 'slot' | 'profile_check';
  data: {
    name?: string;
    phone?: string;
    clinicId?: string;
    clinicName?: string;
    date?: Date;
    slot?: string;
    availableSlots?: string[];
    shownSlotsOffset?: number;
  };
}

interface AdminState {
  step: 'none' | 'create_clinic_name' | 'create_clinic_location' | 'create_clinic_hours';
  data: {
    name?: string;
    location?: string;
    hours?: string;
  };
}

const KNOWLEDGE_BASE = [
  { keywords: ['location', 'where', 'address', 'find'], answer: 'LASUTH is located at 1-5 Oba Akinjobi Way, Ikeja, Lagos. We are easily accessible from the Ikeja Bus Stop.' },
  { keywords: ['time', 'hour', 'open', 'close', 'operating'], answer: 'Our clinics generally operate from 8:00 AM to 4:00 PM, Monday to Friday. Emergency services (A&E) are available 24/7.' },
  { keywords: ['contact', 'phone', 'email', 'support', 'help desk'], answer: 'You can reach our support team at info@lasuth.org.ng or call our emergency line.' },
  { keywords: ['parking', 'car', 'park'], answer: 'Visitor parking is available near the main gate. Please follow the security personnel\'s instructions.' },
  { keywords: ['visit', 'visiting'], answer: 'General visiting hours are from 4:00 PM to 6:00 PM daily. Only 2 visitors are allowed per patient at a time.' },
  { keywords: ['payment', 'pay', 'cost', 'fee'], answer: 'We accept cash, POS, and bank transfers. Payment points are available at the main reception hall.' },
  { keywords: ['who are you', 'your name', 'what are you'], answer: 'I am Lara, your personal Health Assistant. I can help with bookings, queue tracking, and answer your medical questions!' },
];

export const AIChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hello! I am Lara, your Health Assistant. How can I help you today?', type: 'options', options: [
      { label: 'ðŸ“… Book Appointment', value: 'book' },
      { label: 'ðŸ”¢ Track Queue Status', value: 'track' },
      { label: 'ðŸ”‘ Login Help', value: 'login' },
      { label: 'ðŸ“ Sign Up Help', value: 'signup' },
      { label: 'â“ What I can help with!', value: 'help' }
    ]}
  ]);

  // Update welcome message based on user role
  useEffect(() => {
    if (authLoading) return;

    let welcomeText = 'Hello! I am Lara, your Health Assistant. How can I help you today?';
    let welcomeOptions: Message['options'] = [
      { label: 'ðŸ“… Book Appointment', value: 'book' },
      { label: 'ðŸ”¢ Track Queue Status', value: 'track' },
      { label: 'ðŸ©º Health Facts', value: 'tell me about healthy lifestyle' },
      { label: 'ï¿½ Chat with Lara', value: 'enter_medical_chat' },
      { label: 'ï¿½ Login Help', value: 'login' },
      { label: 'ðŸ“ Sign Up Help', value: 'signup' },
      { label: 'â“ What I can help with!', value: 'help' }
    ];

    if (user) {
      if (user.role === 'admin') {
        welcomeText = `Hello Admin ${user.full_name || user.username}! I am Lara. I can help you manage clinics and users.`;
        welcomeOptions = [
          { label: 'ðŸ¥ Create New Clinic', value: 'admin_create_clinic' },
          { label: 'ðŸ‘¥ Approve Users', value: 'admin_approve_users' },
          { label: 'ðŸ“Š Dashboard', value: 'admin_manage_users' },
          { label: 'ðŸ’¬ Chat with Lara', value: 'enter_medical_chat' },
          { label: 'â“ What I can help with!', value: 'help' }
        ];
      } else if (user.role === 'staff') {
        welcomeText = `Hello ${user.full_name || user.username}! I am Lara. Ready to assist with queue management.`;
        welcomeOptions = [
          { label: 'ðŸ”¢ Check Queue Status', value: 'staff_check_queue' },
          { label: 'ðŸ“… Book Appointment', value: 'book' },
          { label: 'ðŸ’¬ Chat with Lara', value: 'enter_medical_chat' },
          { label: 'â“ What I can help with!', value: 'help' }
        ];
      } else if (user.role === 'doctor') {
        welcomeText = `Hello Dr. ${user.full_name || user.username}! I am Lara. Ready to assist you.`;
        welcomeOptions = [
          { label: 'ðŸ‘¨â€âš•ï¸ Check My Queue', value: 'staff_check_queue' },
          { label: 'ðŸ’¬ Chat with Lara', value: 'enter_medical_chat' },
          { label: 'â“ What I can help with!', value: 'help' }
        ];
      } else {
        welcomeText = `Hello ${user.full_name || user.username}! I am Lara, your Health Assistant.`;
      }
    }

    setMessages(prev => {
      // Only update if it's the initial message
      if (prev.length === 1 && prev[0].id === '1') {
        return [{
          id: '1',
          sender: 'bot',
          text: welcomeText,
          type: 'options',
          options: welcomeOptions
        }];
      }
      return prev;
    });
  }, [user, authLoading]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [bookingState, setBookingState] = useState<BookingState>({ step: 'none', data: {} });
  const [adminState, setAdminState] = useState<AdminState>({ step: 'none', data: {} });
  const [chatMode, setChatMode] = useState<'general' | 'medical'>('general');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [clinics, setClinics] = useState<any[]>([]);

  // Hide on TV Display or specific pages if needed
  if (location.pathname.startsWith('/display')) return null;

  useEffect(() => {
    // Auto-hide hint after 5 seconds
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowHint(false);
      } else {
        setShowHint(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    // Load clinics for booking
    getClinics().then(setClinics).catch(() => {});
  }, []);

  const addMessage = (text: string, sender: 'user' | 'bot', type: Message['type'] = 'text', options?: Message['options'], data?: any) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender, text, type, options, data }]);
  };

  const checkQueueStatus = async (query: string) => {
    setIsTyping(true);
    try {
      const hasLetters = /[a-zA-Z]/.test(query);
      const type = hasLetters ? 'ticket' : 'phone';
      const results = await searchAppointments(type, query);
      setIsTyping(false);
      
      if (results && results.length > 0) {
        // Sort by scheduled_time descending to get latest
        const sorted = results.sort((a: any, b: any) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
        const appt = sorted[0];
        
        addMessage(`Appointment found for ${appt.patient_name || 'Patient'}.`, 'bot');
        addMessage(`Ticket Number: ${appt.ticket_code}`, 'bot');
        addMessage(`Clinic: ${appt.clinic_name || 'General'}`, 'bot');
        addMessage(`Status: ${appt.status.toUpperCase()}`, 'bot');
        
        if (appt.status === 'booked') {
            const date = new Date(appt.scheduled_time);
            addMessage(`Scheduled for: ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, 'bot');
        } else if (appt.status === 'waiting' || appt.status === 'pending') {
            addMessage('You are currently in the queue. Please check the display screens.', 'bot');
        }
      } else {
        addMessage(`No appointments found for "${query}". Please check the details and try again.`, 'bot');
      }
    } catch (e) {
      setIsTyping(false);
      addMessage('Error checking status. Please try again.', 'bot');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const text = inputText.trim();
    setInputText('');
    addMessage(text, 'user');
    setIsTyping(true);

    // Simulate network delay for "AI" feel
    setTimeout(() => {
      processInput(text);
    }, 800);
  };

  const handleOptionClick = (value: string, label: string) => {
    addMessage(label, 'user');
    setIsTyping(true);
    setTimeout(() => {
      processInput(value, true);
    }, 600);
  };

  const handleAdminFlow = async (text: string) => {
    const { step, data } = adminState;

    if (step === 'create_clinic_name') {
      setAdminState({ step: 'create_clinic_location', data: { ...data, name: text } });
      addMessage(`Okay, where is ${text} located?`, 'bot');
    } else if (step === 'create_clinic_location') {
      setAdminState({ step: 'create_clinic_hours', data: { ...data, location: text } });
      addMessage('What are the operating hours? (e.g. 08:00 - 16:00)', 'bot');
    } else if (step === 'create_clinic_hours') {
      const clinicData = {
        name: data.name,
        location: data.location,
        active_hours: text,
        theme_color: '#3b82f6' // Default
      };
      
      addMessage(`Creating ${clinicData.name}...`, 'bot');
      try {
        await adminCreateClinic(clinicData);
        addMessage(`Success! ${clinicData.name} has been created.`, 'bot');
        setAdminState({ step: 'none', data: {} });
      } catch (e) {
        addMessage('Error creating clinic. Please try again.', 'bot');
        setAdminState({ step: 'none', data: {} });
      }
    }
  };

  const processInput = async (text: string, isOption = false) => {
    const lowerText = text.toLowerCase();
    setIsTyping(false);

    // 0. Handle Admin Flow
    if (adminState.step !== 'none') {
      handleAdminFlow(text);
      return;
    }

    // 1. Handle Active Booking Flow
    if (bookingState.step !== 'none') {
      handleBookingFlow(text);
      return;
    }

    if (lowerText === 'enter_medical_chat') {
      setChatMode('medical');
      addMessage("I'm listening. You can ask me about symptoms, diseases, diet, or general health advice.", 'bot');
      return;
    }

    if (chatMode === 'medical') {
      if (lowerText === 'exit' || lowerText === 'quit' || lowerText === 'menu' || lowerText === 'help') {
        setChatMode('general');
        addMessage("Exiting medical chat mode. How else can I help?", 'bot', 'options', [
          { label: 'ðŸ“… Book Appointment', value: 'book' },
          { label: 'ðŸ”¢ Track Queue Status', value: 'track' },
          { label: 'ðŸ©º Health Facts', value: 'tell me about healthy lifestyle' },
          { label: 'ðŸ’¬ Chat with Lara', value: 'enter_medical_chat' }
        ]);
        return;
      }
      
      const medicalResponse = analyzeMedicalQuery(text);
      if (medicalResponse) {
          addMessage(medicalResponse, 'bot');
      } else {
          // Conversational fallback for medical mode
          const fallbacks = [
            "I see. Could you describe that in more detail?",
            "I'm listening. Please tell me more about your symptoms.",
            "That sounds concerning. Have you seen a doctor about this yet?",
            "I am still learning about that specific topic. Try asking about common conditions like Malaria, Diabetes, or Diet."
          ];
          addMessage(fallbacks[Math.floor(Math.random() * fallbacks.length)], 'bot');
      }
      return;
    }

    // Role-Based Commands & Options
    if (lowerText === 'admin_create_clinic') {
        if (user?.role !== 'admin') {
            addMessage('You do not have permission to perform this action.', 'bot');
            return;
        }
        setAdminState({ step: 'create_clinic_name', data: {} });
        addMessage('Let\'s create a new clinic. What is the name of the clinic?', 'bot');
        return;
    }

    if (lowerText === 'admin_approve_users') {
        if (user?.role !== 'admin') return;
        addMessage('Fetching pending users...', 'bot');
        try {
            const users = await adminGetUsers();
            const pending = users?.filter((u: any) => !u.approved) || [];
            if (pending.length === 0) {
                addMessage('No pending users found.', 'bot');
            } else {
                addMessage(`Found ${pending.length} pending users:`, 'bot', 'options', 
                    pending.map((u: any) => ({ label: `Approve ${u.full_name} (${u.role})`, value: `approve_user_${u.id}` }))
                );
            }
        } catch (e) {
            addMessage('Error fetching users.', 'bot');
        }
        return;
    }

    if (lowerText.startsWith('approve_user_')) {
        if (user?.role !== 'admin') return;
        const userId = lowerText.replace('approve_user_', '');
        addMessage('Approving user...', 'bot');
        try {
            await adminApproveUser(userId);
            addMessage('User approved successfully!', 'bot');
        } catch (e) {
            addMessage('Error approving user.', 'bot');
        }
        return;
    }

    if (lowerText === 'admin_manage_users') {
        if (user?.role !== 'admin') return;
        addMessage('User management is best done on the full dashboard. Shall I take you there?', 'bot', 'options', [
            { label: 'Yes, Go to Dashboard', value: 'go_dashboard' },
            { label: 'No, stay here', value: 'cancel' }
        ]);
        return;
    }

    if (lowerText === 'staff_check_queue') {
         if (!user?.clinic_id) {
             addMessage('You are not assigned to any clinic.', 'bot');
             return;
         }
         addMessage('Fetching queue status...', 'bot');
         try {
             const status = await getQueueStatus(user.clinic_id);
             addMessage(`Queue Status for your clinic:`, 'bot');
             addMessage(`Waiting: ${status.totalWaiting}`, 'bot');
             addMessage(`Current Serving: ${status.currentServing ? status.currentServing.ticket_number : 'None'}`, 'bot');
         } catch (e) {
             addMessage('Error fetching queue status.', 'bot');
         }
         return;
    }

    // 2. Intent Recognition
    if (lowerText.includes('login') || lowerText.includes('sign in')) {
      if (user) {
         addMessage(`You are already logged in as ${user.full_name}.`, 'bot');
         addMessage('Would you like to go to your dashboard?', 'bot', 'options', [
            { label: 'Yes, Go to Dashboard', value: 'go_dashboard' },
            { label: 'No, stay here', value: 'cancel' }
         ]);
      } else {
        addMessage('I can take you to the login page.', 'bot');
        setTimeout(() => {
          navigate('/login');
          setIsOpen(false);
        }, 1500);
      }
      return;
    }

    if (lowerText.includes('signup') || lowerText.includes('sign up') || lowerText.includes('register') || lowerText.includes('create account')) {
      if (user) {
         addMessage(`You are already registered and logged in as ${user.full_name}.`, 'bot');
      } else {
        addMessage('I can take you to the registration page.', 'bot');
        setTimeout(() => {
          navigate('/signup');
          setIsOpen(false);
        }, 1500);
      }
      return;
    }

    // Navigation Commands
    if (lowerText === 'go_dashboard' || lowerText.includes('dashboard')) {
       if (!user) {
          addMessage('You need to login first.', 'bot');
          setTimeout(() => navigate('/login'), 1000);
          return;
       }
       const path = user.role === 'admin' ? '/admin' : user.role === 'doctor' ? '/doctor' : '/staff';
       addMessage(`Taking you to your ${user.role} dashboard...`, 'bot');
       setTimeout(() => {
          navigate(path);
          setIsOpen(false);
       }, 1000);
       return;
    }

    if (lowerText.includes('profile') || lowerText.includes('my account')) {
       if (!user) {
           addMessage('Please login to view your profile.', 'bot');
           return;
       }
       navigate('/profile');
       setIsOpen(false);
       return;
    }

    if (lowerText.includes('my appointments') || lowerText.includes('history')) {
       navigate('/my-appointments');
       setIsOpen(false);
       return;
    }

    // 3. Medical Knowledge Engine
    const medicalResponse = analyzeMedicalQuery(text);
    if (medicalResponse) {
        addMessage(medicalResponse, 'bot');
        return;
    }

    // Knowledge Base Search
    const kbMatch = KNOWLEDGE_BASE.find(item => item.keywords.some(k => lowerText.includes(k)));
    if (kbMatch) {
       addMessage(kbMatch.answer, 'bot');
       return;
    }

    // Clinic Info Query
    if (lowerText.includes('clinic')) {
       const foundClinic = clinics.find(c => lowerText.includes(c.name.toLowerCase()));
       if (foundClinic) {
          addMessage(`Yes, we have the ${foundClinic.name}. You can book an appointment or check the queue for it.`, 'bot', 'options', [
             { label: `Book ${foundClinic.name}`, value: `book_${foundClinic.id}` },
             { label: 'Check Queue', value: 'track' }
          ]);
          return;
       }
    }

    if (lowerText.includes('help') || lowerText.includes('what can you do') || lowerText.includes('capabilities')) {
      addMessage("I'm here to help make your hospital visit smoother and healthier. I can:", 'bot');
      setTimeout(() => {
         addMessage("â€¢ Answer medical & health questions\nâ€¢ Book new appointments\nâ€¢ Check your position in the queue\nâ€¢ Help you log in to your dashboard", 'bot', 'options', [
            { label: 'Start Booking', value: 'book' },
            { label: 'Health Facts', value: 'tell me a health fact' },
            { label: 'Chat with Lara', value: 'enter_medical_chat' },
            { label: 'Check Queue', value: 'track' }
         ]);
      }, 500);
      return;
    }

    if (lowerText.includes('book') || lowerText.includes('appointment')) {
      // Check if specific clinic is mentioned in the booking request
      const foundClinic = clinics.find(c => lowerText.includes(c.name.toLowerCase()));
      if (foundClinic) {
          startBookingFlow(foundClinic.id);
      } else {
          startBookingFlow();
      }
      return;
    }

    if (lowerText.startsWith('book_')) {
       const clinicId = lowerText.replace('book_', '');
       startBookingFlow(clinicId);
       return;
    }

    if (lowerText.includes('track') || lowerText.includes('queue') || lowerText.includes('status')) {
      addMessage('Please enter your Ticket Number (e.g., W-001) or Phone Number to check your status.', 'bot');
      // We could set a tracking state, but for now let's just use regex on next input or simple check
      return;
    }

    // Check if input looks like a ticket number
    if (text.match(/^[A-Z]-\d+$/) || text.startsWith('W-')) {
       checkQueueStatus(text);
       return;
    }

    // Check if input looks like a phone number (mostly digits, length > 6)
    // Strip spaces/dashes to check digit count
    const digitCount = text.replace(/\D/g, '').length;
    if (digitCount >= 7 && text.match(/^[\d\+\-\s]+$/)) {
       checkQueueStatus(text);
       return;
    }

    // Default Fallback
    addMessage("I'm not sure I understand. I can help with Bookings, Queue Tracking, or answer Health Questions.", 'bot', 'options', [
      { label: 'Book Appointment', value: 'book' },
      { label: 'Health Facts', value: 'tell me about healthy lifestyle' },
      { label: 'Chat with Lara', value: 'enter_medical_chat' },
      { label: 'Track Queue', value: 'track' },
      { label: 'Login', value: 'login' }
    ]);
  };

  const startBookingFlow = (preselectedClinicId?: string) => {
    const initialData = preselectedClinicId ? { 
        clinicId: preselectedClinicId, 
        clinicName: clinics.find(c => c.id === preselectedClinicId)?.name 
    } : {};

    // If logged in, skip name/phone or ask confirmation
    if (user && user.full_name) {
       addMessage(`Hi ${user.full_name}, shall I use your profile details for this booking?`, 'bot', 'options', [
          { label: 'Yes, use my profile', value: 'use_profile' },
          { label: 'No, use different details', value: 'manual_details' }
       ]);
       // We set a temporary step to handle this choice
       setBookingState({ step: 'profile_check', data: initialData });
       return;
    }

    setBookingState({ step: 'name', data: initialData });
    addMessage('I can help you book an appointment. First, what is your full name?', 'bot');
  };

  const handleBookingFlow = async (text: string) => {
    const { step, data } = bookingState;

    if (step === 'profile_check') {
       if (text === 'use_profile' || text.toLowerCase().includes('yes')) {
          const nextData = { ...data, name: user?.full_name || '', phone: user?.username || '' }; // Phone fallback
          
          if (nextData.clinicId) {
             setBookingState({ step: 'date', data: nextData });
             addMessage(`Great, booking for ${nextData.clinicName}. When would you like to come?`, 'bot', 'options', [
                { label: 'Today', value: 'today' },
                { label: 'Tomorrow', value: 'tomorrow' }
             ]);
          } else {
             setBookingState({ step: 'clinic', data: nextData });
             addMessage('Great. Please select a clinic:', 'bot', 'options', clinics.map(c => ({ label: c.name, value: `clinic_${c.id}` })));
          }
       } else {
          setBookingState({ step: 'name', data: data }); // Keep clinicId if set
          addMessage('Okay. What is your full name?', 'bot');
       }
       return;
    }

    if (step === 'name') {
      setBookingState({ step: 'phone', data: { ...data, name: text } });
      addMessage(`Thanks ${text}. What is your phone number?`, 'bot');
    } else if (step === 'phone') {
      const nextData = { ...data, phone: text };
      
      if (nextData.clinicId) {
         setBookingState({ step: 'date', data: nextData });
         addMessage(`You are booking for ${nextData.clinicName}. When would you like to come?`, 'bot', 'options', [
            { label: 'Today', value: 'today' },
            { label: 'Tomorrow', value: 'tomorrow' }
         ]);
      } else {
         setBookingState({ step: 'clinic', data: nextData });
         const clinicOptions = clinics.map(c => ({ label: c.name, value: `clinic_${c.id}` }));
         addMessage('Please select a clinic:', 'bot', 'options', clinicOptions);
      }
    } else if (step === 'clinic') {
      // Expecting clinic selection via text or option
      // If user typed it manually, try to find it, otherwise rely on option click (which sends value)
      let clinicId = '';
      let clinicName = '';

      if (text.startsWith('clinic_')) {
        clinicId = text.replace('clinic_', '');
        clinicName = clinics.find(c => c.id === clinicId)?.name || '';
      } else {
        // Fuzzy match?
        const found = clinics.find(c => c.name.toLowerCase().includes(text.toLowerCase()));
        if (found) {
          clinicId = found.id;
          clinicName = found.name;
        } else {
           addMessage('Please select a valid clinic from the options.', 'bot');
           return;
        }
      }

      setBookingState({ step: 'date', data: { ...data, clinicId, clinicName } });
      addMessage(`Great, you selected ${clinicName}. When would you like to come?`, 'bot', 'options', [
        { label: 'Today', value: 'today' },
        { label: 'Tomorrow', value: 'tomorrow' }
      ]);
      
    } else if (step === 'date') {
      let selectedDate = new Date();
      let dateStr = '';
      const lowerText = text.toLowerCase();

      if (lowerText === 'today') {
        // selectedDate is already now
      } else if (lowerText === 'tomorrow') {
        selectedDate.setDate(selectedDate.getDate() + 1);
      } else {
        // Try to parse YYYY-MM-DD
        // Append time to ensure local parsing if just date is provided
        const parsed = new Date(text.includes('T') ? text : text + 'T00:00:00');
        if (!isNaN(parsed.getTime())) {
          selectedDate = parsed;
        } else {
          addMessage('Please enter a valid date (e.g., YYYY-MM-DD) or select Today/Tomorrow.', 'bot');
          return;
        }
      }

      // Format date as YYYY-MM-DD using local time to ensure accuracy
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
      
      setBookingState({ step: 'slot', data: { ...data, date: selectedDate } });
      
      addMessage(`Checking available slots for ${dateStr}...`, 'bot');
      
      try {
         setIsTyping(true);
         const slots = await getSlots(data.clinicId!, dateStr);
         setIsTyping(false);
         
         if (slots.length === 0) {
             addMessage(`Sorry, no slots available for ${dateStr}. Please try another date or use the full booking page.`, 'bot');
             addMessage('Please select another date:', 'bot', 'options', [
                { label: 'Today', value: 'today' },
                { label: 'Tomorrow', value: 'tomorrow' }
             ]);
             setBookingState({ step: 'date', data }); // Go back to date step
             return;
         }

         // Store all slots and initial offset
         const updatedData = { ...data, date: selectedDate, availableSlots: slots, shownSlotsOffset: 0 };
         setBookingState({ step: 'slot', data: updatedData });

         const limit = 4;
         const slotOptions = slots.slice(0, limit).map((s: string) => ({ label: s, value: `slot_${s}` }));
         
         if (slots.length > limit) {
             slotOptions.push({ label: 'Show more times', value: 'show_more_slots' });
         }

         addMessage(`Here are some available slots for ${dateStr}:`, 'bot', 'options', slotOptions);
      } catch (e) {
         setIsTyping(false);
         addMessage('Error fetching slots. Please try again later.', 'bot');
         setBookingState({ step: 'none', data: {} });
      }

    } else if (step === 'slot') {
       if (text === 'show_more_slots') {
           const allSlots = data.availableSlots || [];
           const currentOffset = data.shownSlotsOffset || 0;
           const limit = 4;
           const nextOffset = currentOffset + limit;
           
           if (nextOffset >= allSlots.length) {
               addMessage('No more slots available for this day.', 'bot');
               // Optionally loop back or show "Select another date"
               return;
           }

           const nextSlots = allSlots.slice(nextOffset, nextOffset + limit);
           const slotOptions = nextSlots.map((s: string) => ({ label: s, value: `slot_${s}` }));
           
           if (nextOffset + limit < allSlots.length) {
               slotOptions.push({ label: 'Show more times', value: 'show_more_slots' });
           } else {
               // Maybe add option to go back to start?
               slotOptions.push({ label: 'Start over', value: 'start_over_slots' });
           }

           setBookingState({ step: 'slot', data: { ...data, shownSlotsOffset: nextOffset } });
           addMessage('Here are more available times:', 'bot', 'options', slotOptions);
           return;
       }

       if (text === 'start_over_slots') {
           const allSlots = data.availableSlots || [];
           const limit = 4;
           const slotOptions = allSlots.slice(0, limit).map((s: string) => ({ label: s, value: `slot_${s}` }));
           
           if (allSlots.length > limit) {
               slotOptions.push({ label: 'Show more times', value: 'show_more_slots' });
           }
           
           setBookingState({ step: 'slot', data: { ...data, shownSlotsOffset: 0 } });
           addMessage('Here are the initial slots:', 'bot', 'options', slotOptions);
           return;
       }

       if (text.startsWith('slot_')) {
           const slotTime = text.replace('slot_', '');
           
           // Perform Booking
           const appointmentDate = new Date(data.date!);
           const [hours, mins] = slotTime.split(':').map(Number);
           appointmentDate.setHours(hours, mins, 0, 0);

           setIsTyping(true);
           try {
               const result = await bookAppointment({
                   clinicId: data.clinicId,
                   slotTime: appointmentDate.toISOString(),
                   fullName: data.name,
                   phone: data.phone,
                   email: '', // Optional
                   notifySms: false,
                   notifyEmail: false
               });
               setIsTyping(false);
               
               const ticketCode = result.appointment?.ticket_code || 'CONFIRMED';
               
               addMessage(`âœ… Appointment Confirmed!`, 'bot');
               addMessage(`Patient: ${data.name}`, 'bot');
               addMessage(`Clinic: ${data.clinicName}`, 'bot');
               addMessage(`Date: ${appointmentDate.toLocaleDateString()}`, 'bot');
               addMessage(`Time: ${slotTime}`, 'bot');
               addMessage(`Ticket Number: ${ticketCode}`, 'bot');
               
               addMessage('Is there anything else I can help you with?', 'bot', 'options', [
                  { label: 'Track Queue', value: 'track' },
                  { label: 'Login', value: 'login' }
               ]);
               
               setBookingState({ step: 'none', data: {} });
           } catch (e: any) {
               setIsTyping(false);
               addMessage(`Booking failed: ${e.message || 'Unknown error'}. Please try again.`, 'bot');
               setBookingState({ step: 'none', data: {} });
           }
       } else {
           addMessage('Please select a slot.', 'bot');
       }
    }
  };



  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white w-80 sm:w-96 h-[500px] rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden mb-4 animate-fade-in-up">
          {/* Header */}
          <div className="bg-green-700 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-2 rounded-full">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Lara</h3>
                <p className="text-xs text-green-100 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Online
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-grow p-4 overflow-y-auto bg-gray-50 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0">
                    <Bot className="w-4 h-4 text-green-700" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl p-3 ${
                  msg.sender === 'user' 
                    ? 'bg-green-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  
                  {/* Options Buttons */}
                  {msg.type === 'options' && msg.options && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOptionClick(opt.value, opt.label)}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full hover:bg-green-100 transition font-medium"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.sender === 'user' && (
                   <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-2 flex-shrink-0">
                     <User className="w-4 h-4 text-gray-500" />
                   </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-2">
                  <Bot className="w-4 h-4 text-green-700" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none p-4 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-grow border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
              <button 
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      {!isOpen && showHint && (
        <div className="mr-4 mb-2 bg-white px-4 py-2 rounded-lg shadow-lg border border-green-100 animate-bounce transition-opacity duration-300">
           <p className="text-sm font-medium text-gray-700">Need help? Chat with AI Assistant ðŸ‘‹</p>
           {/* Triangle pointer */}
           <div className="absolute -bottom-1 right-8 w-3 h-3 bg-white transform rotate-45 border-b border-r border-green-100"></div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'} text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center justify-center`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
};
