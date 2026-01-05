import { Router } from 'express';
import { db } from '../models/mockDb';
import { NotificationService } from '../services/notification';

export const queueRouter = (io: any) => {
    const router = Router();

    const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };
    const deg2rad = (deg: number) => deg * (Math.PI / 180);

    // Public Settings (Hospital Location)
    router.get('/settings/location', async (req, res) => {
        try {
            const settings = await db.getSettings();
            res.json({
                hospital_location: settings.hospital_location,
                geofence_radius_km: settings.geofence_radius_km || 0.5
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    });

    // Get Queue Status
    router.get('/:clinicId', async (req, res) => {
        const { clinicId } = req.params;
        const queue = await db.getQueueByClinic(clinicId);
        
        // Calculate estimated wait time (e.g., 15 mins per patient ahead)
        const waitTime = queue.length * 15;
        
        const serving = queue.find(q => q.status === 'serving');

        res.json({
            queue,
            currentServing: serving,
            totalWaiting: queue.filter(q => q.status === 'waiting').length,
            waitTime
        });
    });

    // Check-in (Add to Queue)
    router.post('/check-in', async (req, res) => {
        let { appointmentId, clinicId, ticketNumber, patientName } = req.body;
        
        try {
            // Handle Walk-in (No Appointment ID)
            if (!appointmentId) {
                // Auto-generate ticket number if not provided
                if (!ticketNumber) {
                    ticketNumber = await db.generateWalkInTicketNumber(clinicId);
                }

                // Create a temporary "Walk-in" patient record
                const patient = await db.createPatient({
                    full_name: patientName || 'Walk-in Patient',
                    file_no: `W-${Date.now()}`, 
                    phone: '',
                });

                // Create "Walk-in" Appointment
                const appointment = await db.createAppointment({
                    patient_id: patient.id,
                    clinic_id: clinicId,
                    scheduled_time: new Date().toISOString(),
                    ticket_code: ticketNumber,
                    visit_type: 'walk-in',
                });
                
                await db.updateAppointmentStatus(appointment.id, 'checked_in');
                appointmentId = appointment.id;
            }

            const entry = await db.addToQueue({
                appointment_id: appointmentId,
                clinic_id: clinicId,
                ticket_number: ticketNumber,
                patient_name: patientName
            });

            io.to(`clinic-${clinicId}`).emit('queue-update', await getQueueStats(clinicId));

            // Pre-notify next patient if applicable
            const q = await db.getQueueByClinic(clinicId);
            const next = q.find(e => e.status === 'waiting' && !e.notified_next);
            if (next && next.appointment_id) {
                const nextApt = await db.getAppointmentById(next.appointment_id);
                if (nextApt && nextApt.patient) {
                    if (nextApt.notify_sms && nextApt.patient.phone) {
                        NotificationService.sendSMS(nextApt.patient.phone, 'You are next in the queue. Please be ready.');
                    }
                    if (nextApt.notify_email && nextApt.patient.email) {
                        NotificationService.sendEmail(nextApt.patient.email, 'Queue Update', 'You are next in the queue. Please be ready.');
                    }
                    await db.markQueueNextNotified(next.id);
                }
            }

            try {
                await db.addAuditLog({ actor: patientName, action: 'check_in', details: { clinic_id: clinicId, ticket_number: ticketNumber } });
            } catch {}

            if (entry.appointment_id) {
                const apt = await db.getAppointmentById(entry.appointment_id);
                if (apt && apt.patient && apt.patient.phone && apt.notify_sms) {
                    NotificationService.sendSMS(apt.patient.phone, `You are checked in! Your ticket is ${ticketNumber}.`);
                }
            }

            res.status(201).json(entry);
        } catch (error) {
            res.status(500).json({ error: 'Failed to check in' });
        }
    });

    // Staff: Update Status (Call Next, Complete)
    router.patch('/:id/status', async (req, res) => {
        const { id } = req.params;
        const { status, clinicId, notes, role, userId } = req.body; // 'serving' or 'done'
        const doctorId = userId;

        try {
            const updated = await db.updateQueueStatus(id, status, { doctor_id: doctorId });
            
            // Notify if called
            if (status === 'serving' && updated && updated.appointment_id) {
                 const apt = await db.getAppointmentById(updated.appointment_id);
                 if (apt && apt.patient && apt.patient.phone && apt.notify_sms) {
                     const clinic = await db.getClinicById(apt.clinic_id);
                     const clinicName = clinic?.name || 'the clinic room';
                     NotificationService.sendSMS(apt.patient.phone, `It's your turn! Please proceed to ${clinicName}.`);
                 }
            }

            // If completing
            if (status === 'done') {
                // Save notes only if doctor
                if (notes && updated && role === 'doctor') {
                    updated.consultation_notes = notes;
                }

                // Attach doctor who completed
                if (updated && role === 'doctor' && typeof userId === 'string' && userId.length > 0) {
                    (updated as any).doctor_id = userId;
                }

                // Update Appointment (if exists)
                if (updated?.appointment_id) {
                    if (notes && role === 'doctor') {
                        await db.updateAppointmentNotes(updated.appointment_id, notes);
                    }
                    await db.updateAppointmentStatus(updated.appointment_id, 'completed');
                }
            } else if (status === 'no_show') {
                 // Handle No Show
                 if (updated?.appointment_id) {
                     await db.updateAppointmentStatus(updated.appointment_id, 'no_show');
                 }
            }
            
            // Emit update
            if (clinicId) {
                 const stats = await getQueueStats(clinicId);
                 io.to(`clinic-${clinicId}`).emit('queue-update', stats);
                 console.log(`Emitted status update to clinic-${clinicId}`);
                 // Pre-notify next waiting patient
                 const q = await db.getQueueByClinic(clinicId);
                 const next = q.find(e => e.status === 'waiting' && !e.notified_next);
                 if (next && next.appointment_id) {
                     const nextApt = await db.getAppointmentById(next.appointment_id);
                     if (nextApt && nextApt.patient) {
                         if (nextApt.notify_sms && nextApt.patient.phone) {
                             NotificationService.sendSMS(nextApt.patient.phone, 'You are next in the queue. Please be ready.');
                         }
                         if (nextApt.notify_email && nextApt.patient.email) {
                             NotificationService.sendEmail(nextApt.patient.email, 'Queue Update', 'You are next in the queue. Please be ready.');
                         }
                         await db.markQueueNextNotified(next.id);
                     }
                 }
            }

            try {
                await db.addAuditLog({ actor: updated?.patient_name, action: 'queue_status', details: { id, status, clinic_id: clinicId } });
            } catch {}

            // Emit global update for admin
            io.emit('dashboard-update');

            res.json(updated);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update status' });
        }
    });

    // Patient Self Check-in
    router.post('/self-check-in', async (req, res) => {
        const { ticketCode, latitude, longitude } = req.body;
        
        try {
            // 1. Find Appointment
            const appointment = await db.findAppointmentByTicket(ticketCode);
            
            if (!appointment) {
                return res.status(404).json({ error: 'Invalid Ticket Code' });
            }

            if (appointment.status === 'checked_in' || appointment.status === 'completed') {
                return res.status(400).json({ error: 'Ticket already checked in or used' });
            }

            // 1.5 Enforce hospital geofence if configured
            const settings = await db.getSettings();
            if (settings.hospital_location && typeof latitude === 'number' && typeof longitude === 'number') {
                const dist = getDistanceFromLatLonInKm(latitude, longitude, settings.hospital_location.latitude, settings.hospital_location.longitude);
                const radius = Number(settings.geofence_radius_km ?? 0.5);
                if (dist > radius) {
                    return res.status(403).json({ error: `You are ${dist.toFixed(2)}km away. Self check-in requires being at the hospital.` });
                }
            }

            // 2. Add to Queue
            const entry = await db.addToQueue({
                appointment_id: appointment.id,
                clinic_id: appointment.clinic_id,
                ticket_number: appointment.ticket_code,
                patient_name: appointment.patient?.full_name || 'Walk-in'
            });

            // 3. Update Appointment Status
            await db.updateAppointmentStatus(appointment.id, 'checked_in');

            // 4. Emit Update
            io.to(`clinic-${appointment.clinic_id}`).emit('queue-update', await getQueueStats(appointment.clinic_id));

            // Pre-notify next waiting patient
            const q = await db.getQueueByClinic(appointment.clinic_id);
            const next = q.find(e => e.status === 'waiting' && !e.notified_next);
            if (next && next.appointment_id) {
                const nextApt = await db.getAppointmentById(next.appointment_id);
                if (nextApt && nextApt.patient) {
                    if (nextApt.notify_sms && nextApt.patient.phone) {
                        NotificationService.sendSMS(nextApt.patient.phone, 'You are next in the queue. Please be ready.');
                    }
                    if (nextApt.notify_email && nextApt.patient.email) {
                        NotificationService.sendEmail(nextApt.patient.email, 'Queue Update', 'You are next in the queue. Please be ready.');
                    }
                    await db.markQueueNextNotified(next.id);
                }
            }

            try {
                await db.addAuditLog({ actor: appointment.patient?.full_name, action: 'self_check_in', details: { clinic_id: appointment.clinic_id, ticket_number: appointment.ticket_code } });
            } catch {}

            res.json({ success: true, entry, clinicId: appointment.clinic_id });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Check-in failed' });
        }
    });

    return router;
};

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
