import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { db } from './models/mockDb';
import appointmentRoutes from './routes/appointments';
import { queueRouter } from './routes/queue';
import clinicsRouter from './routes/clinics';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import { NotificationService } from './services/notification';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all for dev
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot);
app.use('/uploads', express.static(uploadsRoot));

// Serve Static Files (Client Build)
// Only in production or if build exists
if (process.env.NODE_ENV === 'production' || process.argv.includes('--serve-client')) {
    const clientBuildPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientBuildPath));
    console.log(`Serving static files from: ${clientBuildPath}`);
}


// Routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRouter(io));
app.use('/api/clinics', clinicsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Fallback admin endpoints in case router mounting fails
app.get('/api/admin/clinics', async (req, res) => {
  try { res.json(await db.getClinics()); } catch { res.status(500).json({ error: 'Failed' }); }
});
app.post('/api/admin/clinics', async (req, res) => {
  try { res.status(201).json(await db.createClinic(req.body)); } catch { res.status(500).json({ error: 'Failed' }); }
});
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })));
  } catch { res.status(500).json({ error: 'Failed' }); }
});
app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, role, password } = req.body;
    let pwd = password as string | undefined;
    if (!pwd) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
      const buf = randomBytes(16);
      let out = '';
      for (let i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
      pwd = out;
      const created = await db.createUser({ username, role, password: pwd });
      return res.status(201).json({ id: created.id, username: created.username, role: created.role, temporary_password: pwd });
    }
    if (String(pwd).length < 6) {
      return res.status(400).json({ error: 'Password required (min 6 chars)' });
    }
    const created = await db.createUser({ username, role, password: pwd });
    res.status(201).json({ id: created.id, username: created.username, role: created.role });
  } catch { res.status(500).json({ error: 'Failed' }); }
});
app.get('/api/admin/audit-logs', async (req, res) => {
  try { res.json(await db.getAuditLogs()); } catch { res.status(500).json({ error: 'Failed' }); }
});

// Basic Route
// app.get('/', (req, res) => {
//   res.send('OPD-QMS API is running');
// });

// Fallback for SPA (Single Page Application)
if (process.env.NODE_ENV === 'production' || process.argv.includes('--serve-client')) {
    app.get('*', (req, res) => {
        // Don't intercept API routes
        if (req.path.startsWith('/api')) {
             return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('OPD-QMS API is running (Dev Mode)');
    });
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Helper to get stats for socket broadcast
async function getQueueStats(clinicId: string) {
    const queue = await db.getQueueByClinic(clinicId);
    const serving = queue.find(q => q.status === 'serving');
    return {
        queue,
        currentServing: serving,
        totalWaiting: queue.filter(q => q.status === 'waiting').length,
        waitTime: queue.length * 15
    };
}

// Socket.io
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join clinic room for updates
    socket.on('join-clinic', async (clinicId) => {
      socket.join(`clinic-${clinicId}`);
      console.log(`Socket ${socket.id} joined clinic-${clinicId}`);

      // Emit update to all clients watching this clinic
      io.to(`clinic-${clinicId}`).emit('queue-update', await getQueueStats(clinicId));
      console.log(`Emitted update to clinic-${clinicId}`);
    });

    socket.on('doctor-call-next', async (payload) => {
      try {
        const clinicId = String(payload?.clinicId || '');
        const queueId = String(payload?.queueId || '');
        if (!clinicId || !queueId) return;
        io.to(`clinic-${clinicId}`).emit('staff-call-request', { clinicId, queueId, timestamp: Date.now() });
        try {
          await db.addAuditLog({ actor: 'doctor', action: 'doctor_call_request', details: { clinic_id: clinicId, queue_id: queueId } });
        } catch {}
      } catch {}
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

// Background job: send upcoming appointment reminders
setInterval(async () => {
  try {
    const upcoming = await db.getUpcomingAppointments(60);
    for (const apt of upcoming) {
      if ((apt as any).patient) {
        const patient: any = (apt as any).patient;
        if (apt.notify_sms && patient.phone) {
          const msg = `Reminder: Appointment at ${new Date(apt.scheduled_time).toLocaleString()} | Ticket ${apt.ticket_code}`;
          NotificationService.sendSMS(patient.phone, msg);
        }
        if (apt.notify_email && patient.email) {
          const subject = 'Appointment Reminder';
          const body = `Your ticket ${apt.ticket_code} is scheduled for ${new Date(apt.scheduled_time).toLocaleString()}.`;
          NotificationService.sendEmail(patient.email, subject, body);
        }
      }
      await db.markReminderSent(apt.id);
    }
  } catch (err) {
    console.error('Reminder job failed:', err);
  }
}, 5 * 60 * 1000);

// Start Server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
