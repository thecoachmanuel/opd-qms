import { Router } from 'express';
import { db } from '../models/mockDb';
import { scryptSync } from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/me', async (req, res) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const user = await db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { id, username, role, clinic_id, full_name, email, phone, profile_image } = user;
  res.json({ id, username, role, clinic_id: clinic_id || null, full_name: full_name || '', email: email || '', phone: phone || '', profile_image: profile_image || null });
});

router.put('/me', async (req, res) => {
  const { userId, full_name, email, phone } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const updated = await db.updateUser(String(userId), { full_name, email, phone });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  const { id, username, role, clinic_id } = updated;
  res.json({ id, username, role, clinic_id: clinic_id || null, full_name: updated.full_name || '', email: updated.email || '', phone: updated.phone || '', profile_image: updated.profile_image || null });
});

router.put('/me/password', async (req, res) => {
  const { userId, current_password, new_password } = req.body;
  if (!userId || !new_password) return res.status(400).json({ error: 'userId and new_password required' });
  const user = await db.getUserById(String(userId));
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.password_salt && user.password_hash) {
    const curr = String(current_password || '');
    const hash = scryptSync(curr, user.password_salt, 64).toString('hex');
    if (hash !== user.password_hash) return res.status(401).json({ error: 'Invalid current password' });
  }
  await db.updateUser(String(userId), { password: String(new_password) });
  res.json({ success: true });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const user = await db.getUserById(String(id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { username, role, clinic_id, full_name, email, phone, profile_image } = user;
  res.json({ id, username, role, clinic_id: clinic_id || null, full_name: full_name || '', email: email || '', phone: phone || '', profile_image: profile_image || null });
});

router.put('/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone } = req.body;
  const updated = await db.updateUser(String(id), { full_name, email, phone });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  const { username, role, clinic_id } = updated;
  res.json({ id, username, role, clinic_id: clinic_id || null, full_name: updated.full_name || '', email: updated.email || '', phone: updated.phone || '', profile_image: updated.profile_image || null });
});

router.put('/:id/password/self', async (req, res) => {
  const { id } = req.params;
  const { current_password, new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'new_password required' });
  const user = await db.getUserById(String(id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.password_salt && user.password_hash) {
    const curr = String(current_password || '');
    const hash = scryptSync(curr, user.password_salt, 64).toString('hex');
    if (hash !== user.password_hash) return res.status(401).json({ error: 'Invalid current password' });
  }
  await db.updateUser(String(id), { password: String(new_password) });
  res.json({ success: true });
});

router.put('/me/profile-image', async (req, res) => {
  const { userId, image_base64 } = req.body;
  if (!userId || !image_base64) return res.status(400).json({ error: 'userId and image_base64 required' });
  const user = await db.getUserById(String(userId));
  if (!user) return res.status(404).json({ error: 'Not found' });
  try {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const profileDir = path.join(uploadsRoot, 'profile');
    if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot);
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir);
    const match = String(image_base64).match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });
    const ext = match[2] === 'jpeg' || match[2] === 'jpg' ? 'jpg' : (match[2] === 'webp' ? 'webp' : 'png');
    const data = match[3];
    const buf = Buffer.from(data, 'base64');
    const filename = `user-${user.id}-${Date.now()}.${ext}`;
    const filepath = path.join(profileDir, filename);
    fs.writeFileSync(filepath, buf);
    const publicPath = `/uploads/profile/${filename}`;
    await db.updateUser(String(userId), { profile_image: publicPath });
    res.json({ success: true, profile_image: publicPath });
  } catch {
    res.status(500).json({ error: 'Failed to save image' });
  }
});

export default router;
