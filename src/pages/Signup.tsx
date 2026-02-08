import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authSignup, getClinics } from '../services/api';

export const Signup: React.FC = () => {
  const [form, setForm] = useState({ username: '', full_name: '', role: 'staff', clinic_id: '', password: '', confirm: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [clinics, setClinics] = useState<any[]>([]);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    getClinics().then(setClinics).catch(()=>{});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (!form.username.trim() || !form.full_name.trim()) { setError('Username and Full name are required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    const validRoles = ['staff','doctor'];
    if (!validRoles.includes(form.role as any)) { setError('Role must be staff or doctor'); return; }
    if (!form.clinic_id.trim()) { setError('Please select a clinic'); return; }
    try {
      const resp = await authSignup({ 
        username: form.username.trim(), 
        full_name: form.full_name.trim(), 
        role: form.role as any, 
        clinic_id: form.clinic_id, 
        password: form.password, 
        email: form.email.trim(), 
        phone: form.phone.trim() || undefined 
      });
      if (resp) {
        // Auto-login user (set AuthContext state)
        login(resp);

        if (resp.approved) {
          setMsg('Account created successfully! Redirecting to dashboard...');
          setTimeout(() => {
            if (resp.role === 'admin') navigate('/admin');
            else if (resp.role === 'staff') navigate('/staff');
            else if (resp.role === 'doctor') navigate('/doctor');
            else navigate('/');
          }, 1500);
        } else {
          setMsg('Account created! Awaiting admin approval...');
          // Redirect to Awaiting Approval page immediately (not login)
          // ProtectedRoute would do this anyway, but explicit is better
          setTimeout(() => navigate('/awaiting-approval'), 1500);
        }
      }
      setForm({ username: '', full_name: '', role: 'staff', clinic_id: '', password: '', confirm: '', email: '', phone: '' });
    } catch (err: any) {
      console.error('Signup Error:', err);
      const msg = err.response?.data?.error || err.message || 'Signup failed';
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Create Account</h2>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        {msg && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{msg}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input className="w-full border rounded p-2" placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input className="w-full border rounded p-2" placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Designation</label>
            <p className="text-xs text-gray-500 mb-1">Select your designation: Staff or Doctor.</p>
            <select className="w-full border rounded p-2" value={form.role} onChange={e=>setForm({...form, role: e.target.value})}>
              <option value="staff">Staff</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mt-3">Clinic</label>
            <p className="text-xs text-gray-500 mb-1">Choose the clinic you will work in.</p>
            <select className="w-full border rounded p-2" value={form.clinic_id} onChange={e=>setForm({...form, clinic_id: e.target.value})}>
              <option value="">Select Clinic</option>
              {clinics.map((c:any)=> (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full border rounded p-2" placeholder="Password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" className="w-full border rounded p-2" placeholder="Confirm Password" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input className="w-full border rounded p-2" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (optional)</label>
            <input className="w-full border rounded p-2" placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
          </div>
          <button type="submit" className="w-full bg-green-600 text-white rounded p-2">Sign Up</button>
        </form>
      </div>
    </div>
  );
};

export default Signup;
