import { Router } from 'express';
import { db } from '../models/mockDb';
import { NotificationService } from '../services/notification';

const router = Router();

// Helper to generate time slots
const generateSlots = (startStr: string, endStr: string, intervalMinutes: number) => {
    const slots = [];
    let [startHour, startMin] = startStr.split(':').map(Number);
    const [endHour, endMin] = endStr.split(':').map(Number);

    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);

    const end = new Date();
    end.setHours(endHour, endMin, 0, 0);

    while (current < end) {
        const timeString = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        slots.push(timeString);
        current.setMinutes(current.getMinutes() + intervalMinutes);
    }
    return slots;
};

// Get all appointments (Admin)
router.get('/', async (req, res) => {
    try {
        const appointments = await db.getAllAppointments();
        res.json(appointments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get available clinics
router.get('/clinics', async (req, res) => {
  try {
    const clinics = await db.getClinics();
    res.json(clinics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available slots
router.get('/slots', async (req, res) => {
    const { date, clinicId } = req.query;

    if (!date || !clinicId) {
        return res.status(400).json({ error: 'Missing date or clinicId' });
    }

    try {
        const clinic = await db.getClinicById(String(clinicId));
        if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

        // Parse Active Hours (e.g. "08:00 - 16:00")
        const [start, end] = clinic.active_hours.split(' - ');
        
        // Generate all possible slots
        const allSlots = generateSlots(start, end, 15); // 15 min intervals

        // Fetch existing appointments
        const existingApps = await db.getAppointmentsByClinic(String(clinicId), String(date));
        
        // Filter out booked slots
        // existingApps.scheduled_time is ISO string "2024-01-01T09:00:00"
        const bookedTimes = existingApps.map(a => {
            const d = new Date(a.scheduled_time);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        });

        const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));
        
        res.json(availableSlots);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch slots' });
    }
});

// Search appointments
router.get('/search', async (req, res) => {
    const { type, query } = req.query; // type: 'ticket' | 'phone'
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        if (type === 'ticket') {
            const apt = await db.findAppointmentByTicket(String(query));
            return res.json(apt ? [apt] : []);
        } else if (type === 'phone') {
            const apts = await db.findAppointmentsByPhone(String(query));
            return res.json(apts);
        } else {
            return res.status(400).json({ error: 'Invalid search type' });
        }
    } catch (err) {
        console.error('Search failed:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get patient history
router.get('/patient/:patientId', async (req, res) => {
    const { patientId } = req.params;
    try {
        const history = await db.getAppointmentsByPatientId(patientId);
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get single appointment
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const apt = await db.getAppointmentById(id);
        if (apt) res.json(apt);
        else res.status(404).json({ error: 'Not found' });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching appointment' });
    }
});

// Book Appointment
router.post('/book', async (req, res) => {
  const { fileNo, fullName, phone, email, clinicId, slotTime, notifySms = true, notifyEmail = false } = req.body;

  try {
    // 1. Find or Create Patient
    let patient = await db.findPatientByFileNo(fileNo);

    if (!patient) {
        patient = await db.createPatient({ file_no: fileNo, full_name: fullName, phone, email });
    } else if (email && !patient.email) {
        patient.email = email;
    }

    // 2. Generate Ticket Code
    // Count existing appointments for this clinic today to generate sequential number
    const datePart = slotTime.split('T')[0];
    const existingApps = await db.getAppointmentsByClinic(clinicId, datePart);
    const count = existingApps.length + 1;
    
    const clinic = await db.getClinicById(clinicId);
    const prefix = clinic ? clinic.name.charAt(0).toUpperCase() : 'T';
    
    // Format: C-001
    const ticketCode = `${prefix}-${String(count).padStart(3, '0')}`;
    
    const appointment = await db.createAppointment({
        patient_id: patient.id,
        clinic_id: clinicId,
        scheduled_time: slotTime,
        ticket_code: ticketCode,
        notify_sms: Boolean(notifySms),
        notify_email: Boolean(notifyEmail)
    });

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment
    });

    // Send Notification
    if (patient.phone && appointment.notify_sms) {
        NotificationService.sendSMS(patient.phone, `Appointment Confirmed! Ticket: ${ticketCode}, Date: ${new Date(slotTime).toLocaleString()}`);
    }
    if (patient.email && appointment.notify_email) {
        NotificationService.sendEmail(patient.email, 'Appointment Confirmed', `Your ticket ${ticketCode} is scheduled for ${new Date(slotTime).toLocaleString()}.`);
    }

    try {
        await db.addAuditLog({ actor: patient.full_name, action: 'appointment_booked', details: { ticket_code: ticketCode, clinic_id: clinicId, scheduled_time: slotTime } });
    } catch {}

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Send upcoming appointment reminders (simulated)
router.post('/reminders/send', async (req, res) => {
    try {
        const windowMinutes = Number(req.body.windowMinutes ?? 60);
        const upcoming = await db.getUpcomingAppointments(windowMinutes);
        for (const apt of upcoming) {
            if (apt.patient) {
                if (apt.notify_sms && apt.patient.phone) {
                    NotificationService.sendSMS(apt.patient.phone, `Reminder: Appointment at ${new Date(apt.scheduled_time).toLocaleString()} | Ticket ${apt.ticket_code}`);
                }
                if (apt.notify_email && apt.patient.email) {
                    NotificationService.sendEmail(apt.patient.email, 'Appointment Reminder', `Your ticket ${apt.ticket_code} is scheduled for ${new Date(apt.scheduled_time).toLocaleString()}.`);
                }
            }
            await db.markReminderSent(apt.id);
        }
        res.json({ sent: upcoming.length });
    } catch (err) {
        console.error('Reminder send failed:', err);
        res.status(500).json({ error: 'Reminder send failed' });
    }
});

// Cancel Appointment
router.put('/:id/cancel', async (req, res) => {
    const { id } = req.params;
    try {
        const apt = await db.updateAppointmentStatus(id, 'cancelled');
        if (apt) {
            // Fetch patient details to notify
            const patient = await db.getPatientById(apt.patient_id);
            if (patient && patient.phone) {
                 NotificationService.sendSMS(patient.phone, `Appointment Cancelled. Ticket: ${apt.ticket_code}`);
            }
            res.json(apt);
            try {
                await db.addAuditLog({ actor: patient?.full_name, action: 'appointment_cancelled', details: { ticket_code: apt.ticket_code } });
            } catch {}
        } else {
            res.status(404).json({ error: 'Appointment not found' });
        }
    } catch (err) {
        console.error('Cancel failed:', err);
        res.status(500).json({ error: 'Cancel failed' });
    }
});

export default router;
