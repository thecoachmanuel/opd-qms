import React, { useState, useEffect } from 'react';
import { getClinics, getSlots, bookAppointment, sendBookingConfirmationEmail } from '../services/api';
import { Calendar, User, FileText, Phone, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { format } from 'date-fns';

interface Clinic {
  id: string;
  name: string;
}

export const BookAppointment: React.FC = () => {
  const [step, setStep] = useState(1);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const [formData, setFormData] = useState({
    clinicId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    slotTime: '',
    fileNo: '',
    fullName: '',
    phone: '',
    email: '',
    notifySms: true,
    notifyEmail: false
  });

  useEffect(() => {
    loadClinics();
  }, []);

  useEffect(() => {
    if (formData.clinicId && formData.date) {
      loadSlots();
    }
  }, [formData.clinicId, formData.date]);

  const loadClinics = async () => {
    try {
      const data = await getClinics();
      console.log('Clinics loaded:', data);
      setClinics(data);
    } catch (err) {
      console.error('Failed to load clinics', err);
      alert('Failed to load clinics. Please check server connection.');
    }
  };

  const loadSlots = async () => {
    try {
      const data = await getSlots(formData.clinicId, formData.date);
      setSlots(data);
    } catch (err) {
      console.error('Failed to load slots', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        // Construct full timestamp for slotTime
        // Convert local time to ISO string (UTC) for the server
        const fullTimestamp = new Date(`${formData.date}T${formData.slotTime}:00`).toISOString();
        
        const result = await bookAppointment({
            ...formData,
            slotTime: fullTimestamp
        });
        setSuccess(result);
        setStep(3);
        const url = `${window.location.origin}/check-in?ticket=${encodeURIComponent(result.appointment.ticket_code)}`;
        try {
          const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
          setQrDataUrl(dataUrl);
        } catch {}

        // Send confirmation email (fire and forget)
        if (formData.email) {
            const clinic = clinics.find(c => c.id === formData.clinicId);
            sendBookingConfirmationEmail({
                email: formData.email,
                fullName: formData.fullName,
                ticketCode: result.appointment.ticket_code,
                scheduledTime: fullTimestamp,
                clinicName: clinic?.name || 'Hospital Clinic',
                checkInUrl: url
            });
        }
    } catch (err: any) {
        console.error('Booking failed:', err);
        const errorMsg = err.message || err.error_description || 'Unknown error occurred';
        alert(`Booking Failed: ${errorMsg}. Please check your inputs and try again.`);
    } finally {
        setLoading(false);
    }
  };

  if (step === 3 && success) {
      return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
              <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h2>
                  <p className="text-gray-600 mb-6">Your appointment has been successfully scheduled.</p>
                  
                  <div className="bg-gray-100 p-4 rounded-md mb-6 text-left">
                      <p className="text-sm text-gray-500">Ticket Code:</p>
                      <p className="text-2xl font-bold text-green-600 mb-2">{success.appointment.ticket_code}</p>
                      <p className="text-sm text-gray-500">Date & Time:</p>
                      <p className="font-medium text-gray-900">{new Date(success.appointment.scheduled_time).toLocaleString()}</p>
                      {formData.notifySms && (
                        <p className="text-xs text-gray-500 mt-2">SMS confirmation sent to {formData.phone}.</p>
                      )}
                      {formData.notifyEmail && formData.email && (
                        <p className="text-xs text-gray-500">Email confirmation sent to {formData.email}.</p>
                      )}
                  </div>

                  <button 
                    onClick={() => window.print()}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mt-3"
                  >
                      Print Ticket
                  </button>
                  <div className="hidden print:block w-full mt-8">
                    <div className="max-w-md mx-auto p-8 border-4 border-black">
                      <div className="text-center">
                        <div className="text-5xl font-black">{success.appointment.ticket_code}</div>
                        <div className="mt-2 text-xl">{formData.fullName}</div>
                        <div className="mt-1 text-sm">{formData.phone}{formData.email ? ` • ${formData.email}` : ''}</div>
                        <div className="mt-4 text-lg">{new Date(success.appointment.scheduled_time).toLocaleString()}</div>
                        <div className="mt-1 text-sm">Clinic: {clinics.find(c => c.id === formData.clinicId)?.name}</div>
                      </div>
                      {qrDataUrl && (
                        <div className="mt-6 flex justify-center">
                          <img src={qrDataUrl} alt="Scan to self check-in" className="w-40 h-40" />
                        </div>
                      )}
                      <div className="mt-2 text-center text-xs">Scan to self check-in</div>
                      <div className="mt-6 text-center text-sm">Please arrive 10 minutes early with your ticket.</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 mt-3"
                  >
                      Back to Home
                  </button>
                  <button 
                    onClick={() => window.location.href = '/check-in'}
                    className="w-full flex justify-center py-2 px-4 border border-green-600 rounded-md shadow-sm text-sm font-medium text-green-600 bg-white hover:bg-green-50 mt-3"
                  >
                      I'm at the Hospital (Check In)
                  </button>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900">Book an Appointment</h2>
          <p className="mt-2 text-sm text-gray-600">Step {step} of 2</p>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-6">
            
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Clinic</label>
                  <select 
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-600 focus:border-green-600 sm:text-sm rounded-md border"
                    value={formData.clinicId}
                    onChange={(e) => setFormData({...formData, clinicId: e.target.value})}
                  >
                    <option value="">-- Choose a Clinic --</option>
                    {clinics.map(clinic => (
                      <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Date</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="focus:ring-green-600 focus:border-green-600 block w-full pl-10 sm:text-sm border-gray-300 rounded-md border py-2"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>

                {formData.clinicId && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Available Slots</label>
                        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
                            {slots.map((slot) => (
                                <button
                                    key={slot}
                                    type="button"
                                    onClick={() => setFormData({...formData, slotTime: slot})}
                                    className={`
                                        flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md focus:outline-none
                                        ${formData.slotTime === slot 
                                            ? 'bg-green-600 text-white border-transparent' 
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}
                                    `}
                                >
                                    {slot}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="button"
                        disabled={!formData.slotTime}
                        onClick={() => setStep(2)}
                        className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                        Next Step
                    </button>
                </div>
              </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hospital File Number (If any)</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FileText className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="focus:ring-green-600 focus:border-green-600 block w-full pl-10 sm:text-sm border-gray-300 rounded-md border py-2"
                                placeholder="LAS-0000"
                                value={formData.fileNo}
                                onChange={(e) => setFormData({...formData, fileNo: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                required
                                className="focus:ring-green-600 focus:border-green-600 block w-full pl-10 sm:text-sm border-gray-300 rounded-md border py-2"
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Phone className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="tel"
                                required
                                className="focus:ring-green-600 focus:border-green-600 block w-full pl-10 sm:text-sm border-gray-300 rounded-md border py-2"
                                placeholder="08012345678"
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email (optional)</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="email"
                                className="focus:ring-green-600 focus:border-green-600 block w-full pl-10 sm:text-sm border-gray-300 rounded-md border py-2"
                                placeholder="john@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="inline-flex items-center">
                            <input
                                type="checkbox"
                                className="rounded text-green-600"
                                checked={formData.notifySms}
                                onChange={(e) => setFormData({...formData, notifySms: e.target.checked})}
                            />
                            <span className="ml-2 text-sm text-gray-700">Send me SMS updates</span>
                        </label>
                        <label className="inline-flex items-center">
                            <input
                                type="checkbox"
                                className="rounded text-green-600"
                                checked={formData.notifyEmail}
                                onChange={(e) => setFormData({...formData, notifyEmail: e.target.checked})}
                            />
                            <span className="ml-2 text-sm text-gray-700">Send me Email updates</span>
                        </label>
                    </div>

                    <div className="flex justify-between">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading ? 'Confirming...' : 'Confirm Booking'}
                        </button>
                    </div>
                </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};
