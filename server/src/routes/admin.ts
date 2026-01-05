import { Router } from 'express';
import { db } from '../models/mockDb';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

const getUserFromRequest = async (req: any) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return null;
    return await db.getUserById(String(userId));
};

router.get('/clinics', async (req, res) => {
  try { res.json(await db.getClinics()); } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/clinics', async (req, res) => {
  try { res.status(201).json(await db.createClinic(req.body)); } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/clinics/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await db.updateClinic(id, req.body);
    if (updated) res.json(updated); else res.status(404).json({ error: 'Not found' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/clinics/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await db.deleteClinic(id);
    if (deleted) res.json(deleted); else res.status(404).json({ error: 'Not found' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    const sanitized = users.map(u => ({ id: u.id, username: u.username, role: u.role, clinic_id: (u as any).clinic_id || null, full_name: (u as any).full_name || '', email: (u as any).email || '', phone: (u as any).phone || '', profile_image: (u as any).profile_image || null, approved: (u as any).approved !== false }));
    res.json(sanitized);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/users', async (req, res) => {
  try {
    const { username, role, password, clinic_id, full_name, email, phone } = req.body;
    if (!username || !full_name || !password) {
      return res.status(400).json({ error: 'username, full_name and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const created = await db.createUser({ username, role, password, clinic_id, full_name, email, phone });
    res.status(201).json({ id: created.id, username: created.username, role: created.role, clinic_id: (created as any).clinic_id || clinic_id || null, full_name: (created as any).full_name || '', email: (created as any).email || '', phone: (created as any).phone || '' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { username, role, password, clinic_id, full_name, email, phone, approved } = req.body;
    const updated = await db.updateUser(id, { username, role, password, clinic_id, full_name, email, phone } as any);
    if (typeof approved === 'boolean' && updated) { (updated as any).approved = approved; }
    if (updated) res.json({ id: updated.id, username: updated.username, role: updated.role, clinic_id: (updated as any).clinic_id || null, full_name: (updated as any).full_name || '', email: (updated as any).email || '', phone: (updated as any).phone || '', approved: (updated as any).approved !== false }); else res.status(404).json({ error: 'Not found' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/users/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.getUserById(id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    (user as any).approved = true;
    await db.updateUser(id, {});
    res.json({ id: user.id, approved: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await db.deleteUser(id);
    if (deleted) res.json(deleted); else res.status(404).json({ error: 'Not found' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/audit-logs', async (req, res) => {
  try { res.json(await db.getAuditLogs()); } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/settings', async (req, res) => {
  try { res.json(await db.getSettings()); } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/settings', async (req, res) => {
  try {
    const payload: any = { auto_approve_signups: !!req.body.auto_approve_signups };
    if (req.body.hospital_location && typeof req.body.hospital_location.latitude === 'number' && typeof req.body.hospital_location.longitude === 'number') {
      payload.hospital_location = { latitude: req.body.hospital_location.latitude, longitude: req.body.hospital_location.longitude };
    }
    if (typeof req.body.geofence_radius_km === 'number') {
      payload.geofence_radius_km = req.body.geofence_radius_km;
    }
    const updated = await db.updateSettings(payload);
    res.json(updated);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/site-config', async (req, res) => {
  try { res.json(await db.getSiteConfig()); } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/site-config', async (req, res) => {
  try {
    const updated = await db.updateSiteConfig(req.body);
    res.json(updated);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/site-config/logo', async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });
  try {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const siteDir = path.join(uploadsRoot, 'site');
    if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot);
    if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir);
    
    const match = String(image_base64).match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });
    
    let ext = match[2] === 'jpeg' || match[2] === 'jpg' ? 'jpg' : (match[2] === 'webp' ? 'webp' : (match[2] === 'svg+xml' ? 'svg' : 'png'));
    const data = match[3];
    const buf = Buffer.from(data, 'base64');
    const filename = `site-logo-${Date.now()}.${ext}`;
    const filepath = path.join(siteDir, filename);
    
    fs.writeFileSync(filepath, buf);
    const publicPath = `/uploads/site/${filename}`;
    
    // Auto-update config
    await db.updateSiteConfig({ header: { logo_url: publicPath } } as any);
    
    res.json({ success: true, logo_url: publicPath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save logo' });
  }
});

// Doctor productivity stats
router.get('/stats/doctors', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    const users = await db.getUsers();
    let doctors = users.filter(u => u.role === 'doctor');
    
    // Filter doctors for Clinic Admin
    if (user && user.role === 'admin' && user.clinic_id) {
        doctors = doctors.filter(d => d.clinic_id === user.clinic_id);
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Access queue entries from db (private); we will compute via available methods
    let queue = await (db as any).getAllQueueEntries();
    
    // Filter queue entries for Clinic Admin
    if (user && user.role === 'admin' && user.clinic_id) {
        queue = queue.filter((e: any) => e.clinic_id === user.clinic_id);
    }

    const stats = doctors.map(d => {
      const byDoctor = queue.filter((e: any) => e.doctor_id === d.id && e.status === 'done' && e.service_end_time);
      const daily = byDoctor.filter((e: any) => new Date(e.service_end_time as any) >= startOfToday).length;
      const weekly = byDoctor.filter((e: any) => new Date(e.service_end_time as any) >= startOfWeek).length;
      const monthly = byDoctor.filter((e: any) => new Date(e.service_end_time as any) >= startOfMonth).length;
      return { doctor_id: d.id, doctor_name: d.full_name || d.username, daily, weekly, monthly };
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute doctor stats' });
  }
});

export default router;
