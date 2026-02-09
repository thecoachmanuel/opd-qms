import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, User, Loader, MapPin, Clock, CheckCircle } from 'lucide-react';
import { getClinics, getSlots, bookAppointment, searchAppointments } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  };
}

const KNOWLEDGE_BASE = [
  { keywords: ['location', 'where', 'address', 'find'], answer: 'LASUTH is located at 1-5 Oba Akinjobi Way, Ikeja, Lagos. We are easily accessible from the Ikeja Bus Stop.' },
  { keywords: ['time', 'hour', 'open', 'close', 'operating'], answer: 'Our clinics generally operate from 8:00 AM to 4:00 PM, Monday to Friday. Emergency services (A&E) are available 24/7.' },
  { keywords: ['contact', 'phone', 'email', 'support', 'help desk'], answer: 'You can reach our support team at info@lasuth.org.ng or call our emergency line.' },
  { keywords: ['parking', 'car', 'park'], answer: 'Visitor parking is available near the main gate. Please follow the security personnel\'s instructions.' },
  { keywords: ['visit', 'visiting'], answer: 'General visiting hours are from 4:00 PM to 6:00 PM daily. Only 2 visitors are allowed per patient at a time.' },
  { keywords: ['payment', 'pay', 'cost', 'fee'], answer: 'We accept cash, POS, and bank transfers. Payment points are available at the main reception hall.' },
];

export const AIChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hello! I am your LASUTH AI Assistant. How can I help you today?', type: 'options', options: [
      { label: '📅 Book Appointment', value: 'book' },
      { label: '🔢 Track Queue Status', value: 'track' },
      { label: '🔑 Login Help', value: 'login' },
      { label: '📝 Sign Up Help', value: 'signup' },
      { label: '❓ Hospital Info', value: 'help' }
    ]}
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>({ step: 'none', data: {} });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [clinics, setClinics] = useState<any[]>([]);

  // Hide on TV Display or specific pages if needed
  if (location.pathname.startsWith('/display')) return null;

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

  const processInput = async (text: string, isOption = false) => {
    const lowerText = text.toLowerCase();
    setIsTyping(false);

    // 1. Handle Active Booking Flow
    if (bookingState.step !== 'none') {
      handleBookingFlow(text);
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
      addMessage("I'm here to help make your hospital visit smoother. I can:", 'bot');
      setTimeout(() => {
         addMessage("• Book new appointments\n• Check your position in the queue\n• Help you log in to your dashboard\n• Answer basic questions about clinics", 'bot', 'options', [
            { label: 'Start Booking', value: 'book' },
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
    addMessage("I'm not sure I understand. Would you like to:", 'bot', 'options', [
      { label: 'Book Appointment', value: 'book' },
      { label: 'Track Queue', value: 'track' },
      { label: 'Login', value: 'login' },
      { label: 'Sign Up', value: 'signup' }
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
             // Optionally go back to date step? For now reset or let them try again by typing date? 
             // Let's reset to keep it simple or maybe just stay on date step?
             // Let's stay on date step effectively by asking again?
             addMessage('Please select another date:', 'bot', 'options', [
                { label: 'Today', value: 'today' },
                { label: 'Tomorrow', value: 'tomorrow' }
             ]);
             setBookingState({ step: 'date', data }); // Go back to date step
             return;
         }

         const slotOptions = slots.slice(0, 4).map((s: string) => ({ label: s, value: `slot_${s}` }));
         addMessage(`Here are some available slots for ${dateStr}:`, 'bot', 'options', slotOptions);
      } catch (e) {
         setIsTyping(false);
         addMessage('Error fetching slots. Please try again later.', 'bot');
         setBookingState({ step: 'none', data: {} });
      }

    } else if (step === 'slot') {
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
               
               addMessage(`✅ Appointment Confirmed!`, 'bot');
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

  const checkQueueStatus = async (query: string) => {
     setIsTyping(true);
     try {
         // Auto-detect type
         const hasLetters = /[a-zA-Z]/.test(query);
         const type = hasLetters ? 'ticket' : 'phone';

         const results = await searchAppointments(type, query);
         setIsTyping(false);
         
         if (results && results.length > 0) {
             const appt = results[0];
             addMessage(`Appointment found for ${appt.patients?.full_name}.`, 'bot');
             addMessage(`Ticket Number: ${appt.ticket_code}`, 'bot');
             addMessage(`Status: ${appt.status.toUpperCase()}`, 'bot');
             if (appt.status === 'pending' || appt.status === 'waiting') {
                 addMessage('You are in the queue.', 'bot');
             }
         } else {
             addMessage(`No appointment found for "${query}".`, 'bot');
         }
     } catch (e) {
         setIsTyping(false);
         addMessage('Error checking status.', 'bot');
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
                <h3 className="font-bold">LASUTH Assistant</h3>
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'} text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center justify-center`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
};
