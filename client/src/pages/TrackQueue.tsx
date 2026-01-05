import React, { useState } from 'react';
import { searchAppointments } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export const TrackQueue: React.FC = () => {
  const [ticket, setTicket] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const results = await searchAppointments('ticket', ticket.trim());
      if (Array.isArray(results) && results.length > 0) {
        const apt = results[0];
        navigate(`/queue/${apt.clinic_id}?ticket=${encodeURIComponent(ticket.trim())}`);
      } else {
        setStatus('error');
        setErrorMsg('Ticket not found. Please verify your code.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Failed to search. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-xl overflow-hidden">
        <div className="bg-green-600 px-6 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">Track Live Queue</h1>
          <p className="text-green-100 mt-2">Enter your ticket code to view your clinic's queue.</p>
        </div>
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="ticket" className="block text-sm font-medium text-gray-700 mb-2">Ticket Code</label>
              <input
                type="text"
                id="ticket"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-green-500 focus:border-green-500 placeholder-gray-400"
                placeholder="e.g. T-123"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
              />
            </div>
            {status === 'error' && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">{errorMsg}</div>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full flex items-center justify-center py-3 px-4 rounded-lg text-lg font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {status === 'loading' ? 'Searching...' : (<><Search className="h-5 w-5 mr-2" /> View Live Queue</>)}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

