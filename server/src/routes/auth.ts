import { Router } from 'express';
import { db } from '../models/mockDb';
import { scryptSync } from 'crypto';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body; // username can be username or full_name
  if (!username || !password) {
    return res.status(400).json({ error: 'Username or Full name and password required' });
  }
  try {
    let user = await db.findUserByUsername(String(username));
    if (!user) user = await db.findUserByFullName(String(username));
    if (!user || !user.password_salt || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.approved === false) {
      return res.status(403).json({ error: 'Account pending approval' });
    }
    const hash = scryptSync(String(password), user.password_salt, 64).toString('hex');
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ id: user.id, username: user.username, full_name: user.full_name || user.username, role: user.role, clinic_id: (user as any).clinic_id || null });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role, clinic_id } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'username, full_name and password are required' });
    }
    const validRoles = ['admin','staff','doctor'] as const;
    const selectedRole = validRoles.includes(role) ? role : 'staff';
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existU = await db.findUserByUsername(String(username));
    if (existU) return res.status(409).json({ error: 'Username already exists' });
    const created = await db.createUser({ username, role: selectedRole, clinic_id, password, full_name, email, phone });
    try {
      const settings = await db.getSettings();
      created.approved = !!settings.auto_approve_signups;
    } catch {
      created.approved = false;
    }
    await db.updateUser(created.id, { });
    return res.status(201).json({ id: created.id, username: created.username, role: created.role, clinic_id: (created as any).clinic_id || clinic_id || null, full_name: created.full_name || '', email: created.email || '', phone: created.phone || '', approved: created.approved });
  } catch {
    return res.status(500).json({ error: 'Signup failed' });
  }
});

export default router;
