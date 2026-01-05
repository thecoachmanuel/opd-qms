import { Router } from 'express';
import { db } from '../models/mockDb';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const clinics = await db.getClinics();
    res.json(clinics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clinics' });
  }
});

export default router;
