import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserById, updateUserProfile, updateOwnPassword, uploadUserProfileImage } from '../services/api';
import Avatar from '../components/Avatar';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string; email: string; phone: string; profile_image?: string|null }>({ full_name: '', email: '', phone: '', profile_image: null });
  const [pwd, setPwd] = useState<{ current: string; next: string; confirm: string }>({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    getUserById(user.id).then((u) => {
      setProfile({ full_name: u.full_name || '', email: u.email || '', phone: u.phone || '', profile_image: u.profile_image || null });
    }).catch(() => setErr('Failed to load profile'));
  }, [user]);

  const saveProfile = async () => {
    setErr(''); setMsg('');
    try {
      const resp = await updateUserProfile(user!.id, { full_name: profile.full_name, email: profile.email, phone: profile.phone });
      setProfile({ full_name: resp.full_name || '', email: resp.email || '', phone: resp.phone || '', profile_image: resp.profile_image || profile.profile_image || null });
      setMsg('Profile updated');
    } catch { setErr('Failed to update profile'); }
  };

  const changePassword = async () => {
    setErr(''); setMsg('');
    if (pwd.next.length < 6) { setErr('Password min 6 characters'); return; }
    if (pwd.next !== pwd.confirm) { setErr('Passwords do not match'); return; }
    try {
      await updateOwnPassword(user!.id, pwd.current, pwd.next);
      setMsg('Password changed');
      setPwd({ current: '', next: '', confirm: '' });
    } catch { setErr('Failed to change password'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-4">My Profile</h2>
        {err && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded">{err}</div>}
        {msg && <div className="mb-3 p-2 bg-green-50 text-green-700 rounded">{msg}</div>}

        <div className="space-y-3">
          <input className="w-full border rounded p-2" placeholder="Full Name" value={profile.full_name} onChange={e=>setProfile({...profile, full_name: e.target.value})} />
          <input className="w-full border rounded p-2" placeholder="Email" value={profile.email} onChange={e=>setProfile({...profile, email: e.target.value})} />
          <input className="w-full border rounded p-2" placeholder="Phone" value={profile.phone} onChange={e=>setProfile({...profile, phone: e.target.value})} />
          <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={saveProfile}>Save Profile</button>
        </div>

        <hr className="my-6" />
        <h3 className="text-lg font-semibold mb-2">Profile Picture</h3>
        <div className="space-y-3">
          <Avatar srcPath={profile.profile_image || null} username={(user as any)?.full_name || user?.username} size={80} />
          <input type="file" accept="image/*" onChange={async (e)=>{
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = async () => {
              const dataUrl = String(reader.result || '');
              try {
                const resp = await uploadUserProfileImage(user!.id, dataUrl);
                const fresh = await getUserById(user!.id);
                setProfile({ full_name: fresh.full_name || profile.full_name, email: fresh.email || '', phone: fresh.phone || '', profile_image: fresh.profile_image || resp.profile_image });
                setMsg('Profile picture updated');
              } catch { setErr('Failed to upload image'); }
            };
            reader.readAsDataURL(f);
          }} />
        </div>

        <hr className="my-6" />
        <h3 className="text-lg font-semibold mb-2">Change Password</h3>
        <div className="space-y-3">
          <input type="password" className="w-full border rounded p-2" placeholder="Current Password" value={pwd.current} onChange={e=>setPwd({...pwd, current: e.target.value})} />
          <input type="password" className="w-full border rounded p-2" placeholder="New Password" value={pwd.next} onChange={e=>setPwd({...pwd, next: e.target.value})} />
          <input type="password" className="w-full border rounded p-2" placeholder="Confirm New Password" value={pwd.confirm} onChange={e=>setPwd({...pwd, confirm: e.target.value})} />
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={changePassword}>Change Password</button>
        </div>
      </div>
    </div>
  );
};
