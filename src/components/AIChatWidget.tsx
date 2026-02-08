import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, User, Loader, MapPin, Clock, CheckCircle } from 'lucide-react';
import { getClinics, getSlots, bookAppointment, searchAppointments } from '../services/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  type?: 'text' | 'options' | 'input' | 'clinic-list' | 'slot-list';
  options?: { label: string; value: string }[];
  data?: any;
}

interface BookingState {
  step: 'none' | 'name' | 'phone' | 'clinic' | 'date' | 'slot';
  data: {
    name?: string;
    phone?: string;
    clinicId?: string;
    clinicName?: string;
    date?: Date;
    slot?: string;
  };
}

export const AIChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hello! I am your LASUTH AI Assistant. Here are a few things I can do for you:', type: 'options', options: [
      { label: '📅 Book Appointment', value: 'book' },
      { label: '🔢 Track Queue Status', value: 'track' },
      { label: '🔑 Login Help', value: 'login' },
      { label: '❓ What can you do?', value: 'help' }
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
      addMessage('I can take you to the login page.', 'bot');
      setTimeout(() => {
        navigate('/login');
        setIsOpen(false);
      }, 1500);
      return;
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
      startBookingFlow();
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

    // Default Fallback
    addMessage("I'm not sure I understand. Would you like to:", 'bot', 'options', [
      { label: 'Book Appointment', value: 'book' },
      { label: 'Track Queue', value: 'track' },
      { label: 'Login', value: 'login' }
    ]);
  };

  const startBookingFlow = () => {
    setBookingState({ step: 'name', data: {} });
    addMessage('I can help you book an appointment. First, what is your full name?', 'bot');
  };

  const handleBookingFlow = async (text: string) => {
    const { step, data } = bookingState;

    if (step === 'name') {
      setBookingState({ step: 'phone', data: { ...data, name: text } });
      addMessage(`Thanks ${text}. What is your phone number?`, 'bot');
    } else if (step === 'phone') {
      setBookingState({ step: 'clinic', data: { ...data, phone: text } });
      const clinicOptions = clinics.map(c => ({ label: c.name, value: `clinic_${c.id}` }));
      addMessage('Please select a clinic:', 'bot', 'options', clinicOptions);
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

      setBookingState({ step: 'slot', data: { ...data, clinicId, clinicName } });
      addMessage(`Checking available slots for ${clinicName}...`, 'bot');
      
      try {
         setIsTyping(true);
         // Mocking getting slots or actually fetching?
         // api.ts getAvailableSlots requires a date. Let's assume today/tomorrow for simplicity or ask date?
         // For this simplified AI, let's fetch for tomorrow.
         const tomorrow = new Date();
         tomorrow.setDate(tomorrow.getDate() + 1);
         tomorrow.setHours(0,0,0,0);
         
         // We'll just show some generated slots for the demo or fetch real ones
         const slots = await getSlots(clinicId, tomorrow.toISOString().split('T')[0]);
         setIsTyping(false);
         
         if (slots.length === 0) {
             addMessage('Sorry, no slots available for tomorrow. Please try the full booking page.', 'bot');
             setBookingState({ step: 'none', data: {} });
             return;
         }

         const slotOptions = slots.slice(0, 4).map((s: string) => ({ label: s, value: `slot_${s}` }));
         addMessage('Here are some available slots for tomorrow:', 'bot', 'options', slotOptions);
      } catch (e) {
         setIsTyping(false);
         addMessage('Error fetching slots. Please try again later.', 'bot');
         setBookingState({ step: 'none', data: {} });
      }

    } else if (step === 'slot') {
       if (text.startsWith('slot_')) {
           const slotTime = text.replace('slot_', '');
           // Perform Booking
           const tomorrow = new Date();
           tomorrow.setDate(tomorrow.getDate() + 1);
           const [hours, mins] = slotTime.split(':').map(Number);
           tomorrow.setHours(hours, mins, 0, 0);

           setIsTyping(true);
           try {
               await bookAppointment({
                   clinicId: data.clinicId,
                   slotTime: tomorrow.toISOString(),
                   fullName: data.name,
                   phone: data.phone,
                   email: '', // Optional
                   notifySms: false,
                   notifyEmail: false
               });
               setIsTyping(false);
               addMessage(`Appointment confirmed for ${data.name} at ${data.clinicName} on ${tomorrow.toLocaleDateString()} at ${slotTime}.`, 'bot');
               addMessage('Is there anything else I can help you with?', 'bot');
               setBookingState({ step: 'none', data: {} });
           } catch (e) {
               setIsTyping(false);
               addMessage('Booking failed. Please try again or use the main booking page.', 'bot');
               setBookingState({ step: 'none', data: {} });
           }
       } else {
           addMessage('Please select a slot.', 'bot');
       }
    }
  };

  const checkQueueStatus = async (ticket: string) => {
     setIsTyping(true);
     try {
         // Use searchAppointments from api.ts
         // It returns a list, we take the first
         const results = await searchAppointments('ticket', ticket);
         setIsTyping(false);
         
         if (results && results.length > 0) {
             const appt = results[0];
             addMessage(`Ticket ${ticket} found.`, 'bot');
             addMessage(`Patient: ${appt.patients?.full_name}`, 'bot');
             addMessage(`Status: ${appt.status.toUpperCase()}`, 'bot');
             if (appt.status === 'pending' || appt.status === 'waiting') {
                 addMessage('You are in the queue.', 'bot');
             }
         } else {
             addMessage('Ticket not found.', 'bot');
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
