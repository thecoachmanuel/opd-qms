import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { randomBytes, scryptSync } from 'crypto';

// Types
export interface Clinic {
  id: string;
  name: string;
  location: string;
  active_hours: string;
}

export interface Patient {
  id: string;
  file_no: string;
  full_name: string;
  phone: string;
  email?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  clinic_id: string;
  scheduled_time: string;
  status: 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
  ticket_code: string;
  consultation_notes?: string;
  patient?: Patient; // For joined queries
  notify_sms?: boolean;
  notify_email?: boolean;
  reminder_sent?: boolean;
  visit_type?: 'scheduled' | 'walk-in';
}

export interface QueueEntry {
  id: string;
  appointment_id?: string;
  clinic_id: string;
  ticket_number: string;
  status: 'waiting' | 'serving' | 'done' | 'no_show';
  arrival_time: Date;
  service_start_time?: Date;
  service_end_time?: Date;
  patient_name?: string; // Denormalized for ease
  consultation_notes?: string;
  notified_next?: boolean;
  doctor_id?: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'staff' | 'doctor';
  password_hash?: string;
  password_salt?: string;
  clinic_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  profile_image?: string;
  approved?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor?: string;
  action: string;
  details?: any;
}

export interface Settings {
  auto_approve_signups: boolean;
  hospital_location?: { latitude: number; longitude: number };
  geofence_radius_km?: number;
}

export interface SiteConfig {
  hero: {
    title: string;
    subtitle: string;
    description: string;
    cta_primary_text: string;
    cta_primary_link: string;
    cta_secondary_text: string;
    cta_secondary_link: string;
  };
  header: {
    site_name: string;
    logo_url?: string;
  };
  footer: {
    brand_description: string;
    contact_address: string;
    contact_phone: string;
    contact_email: string;
    social_links: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
  };
  meta: {
    site_title: string;
    site_description: string;
    keywords: string;
  };
}

const DB_PATH = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DB_PATH, 'db_data.json');

class MockDB {
  private clinics: Clinic[] = [
    { id: '1', name: 'General Medicine', location: 'Block A, Room 101', active_hours: '08:00 - 16:00' },
    { id: '2', name: 'Pediatrics', location: 'Block B, Room 205', active_hours: '08:00 - 16:00' },
    { id: '3', name: 'Dental', location: 'Block C, Room 302', active_hours: '09:00 - 15:00' },
    { id: '4', name: 'Orthopedics', location: 'Block A, Room 104', active_hours: '09:00 - 14:00' }
  ];
  private patients: Patient[] = [];
  private appointments: Appointment[] = [];
  private queue: QueueEntry[] = [];
  private users: User[] = [
    { id: 'u-admin', username: 'Admin User', role: 'admin', approved: true },
    { id: 'u-staff', username: 'Staff Member', role: 'staff', approved: true },
    { id: 'u-doctor', username: 'Dr. Smith', role: 'doctor', approved: true }
  ];
  private auditLogs: AuditLog[] = [];
  private settings: Settings = { auto_approve_signups: false, hospital_location: undefined, geofence_radius_km: 0.5 };
  
  private siteConfig: SiteConfig = {
    hero: {
      title: 'Out-Patient Queue',
      subtitle: 'Management System',
      description: 'Streamline your hospital visit. Book appointments, check live queue status, and save time.',
      cta_primary_text: 'Book Appointment',
      cta_primary_link: '/book',
      cta_secondary_text: 'Self Check-in',
      cta_secondary_link: '/check-in'
    },
    header: {
      site_name: 'OPD-QMS',
      logo_url: ''
    },
    footer: {
      brand_description: 'Streamlining healthcare delivery with efficient queue management. Reducing wait times and improving patient experience at LASUTH.',
      contact_address: '1-5 Oba Akinjobi Way, Ikeja, Lagos State, Nigeria',
      contact_phone: '+234 800 LASUTH',
      contact_email: 'info@lasuth.org.ng',
      social_links: {
        facebook: '#',
        twitter: '#',
        instagram: '#',
        linkedin: '#'
      }
    },
    meta: {
      site_title: 'OPD Queue Management System',
      site_description: 'Efficient outpatient department queue management system.',
      keywords: 'hospital, queue, appointment, medical, health'
    }
  };

  constructor() {
      this.loadFromDisk();
      this.ensureFullNames();
      this.ensureExistingUsersApproved();
      this.ensureDefaultCredentials();
  }

  private loadFromDisk() {
      if (fs.existsSync(DB_FILE)) {
          try {
              const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
              this.clinics = data.clinics && Array.isArray(data.clinics) ? data.clinics : this.clinics;
              this.patients = data.patients || [];
              this.appointments = data.appointments || [];
              this.queue = data.queue ? data.queue.map((q: any) => ({
                  ...q,
                  arrival_time: new Date(q.arrival_time),
                  service_start_time: q.service_start_time ? new Date(q.service_start_time) : undefined,
                  service_end_time: q.service_end_time ? new Date(q.service_end_time) : undefined,
              })) : [];
              this.users = data.users || this.users;
              this.auditLogs = data.auditLogs || [];
              this.settings = data.settings || this.settings;
              if (data.siteConfig) {
                this.siteConfig = {
                    ...this.siteConfig,
                    ...data.siteConfig,
                    hero: { ...this.siteConfig.hero, ...(data.siteConfig.hero || {}) },
                    header: { ...this.siteConfig.header, ...(data.siteConfig.header || {}) },
                    footer: { ...this.siteConfig.footer, ...(data.siteConfig.footer || {}) },
                    meta: { ...this.siteConfig.meta, ...(data.siteConfig.meta || {}) }
                };
              }
              console.log('Database loaded from disk.');
          } catch (err) {
              console.error('Failed to load database:', err);
          }
      }
  }

  private saveToDisk() {
      const data = {
          clinics: this.clinics,
          patients: this.patients,
          appointments: this.appointments,
          queue: this.queue,
          users: this.users,
          auditLogs: this.auditLogs,
          settings: this.settings,
          siteConfig: this.siteConfig
      };
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      } catch (err) {
          console.error('Failed to save database:', err);
      }
  }

  private ensureDefaultCredentials() {
    const ensure = (username: string, role: User['role'], password: string) => {
      const existing = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!existing) {
        const salt = randomBytes(16).toString('hex');
        const user: User = {
          id: uuidv4(),
          username,
          role,
          password_salt: salt,
          password_hash: this.hashPassword(password, salt),
          approved: true
        };
        this.users.push(user);
        this.saveToDisk();
      } else if (!existing.password_hash || !existing.password_salt) {
        const salt = randomBytes(16).toString('hex');
        existing.password_salt = salt;
        existing.password_hash = this.hashPassword(password, salt);
        this.saveToDisk();
      }
    };
    try {
      ensure('admin', 'admin', 'admin123');
      ensure('staff', 'staff', 'staff123');
      ensure('doctor', 'doctor', 'doc123');
    } catch {}
  }

  private ensureFullNames() {
    let changed = false;
    this.users.forEach(u => {
      if (!u.full_name || String(u.full_name).trim().length === 0) {
        u.full_name = u.username;
        changed = true;
      }
    });
    if (changed) this.saveToDisk();
  }

  private ensureExistingUsersApproved() {
    let changed = false;
    this.users.forEach(u => {
      if (typeof u.approved !== 'boolean') {
        u.approved = true;
        changed = true;
      }
    });
    if (changed) this.saveToDisk();
  }

  // Clinics
  async getClinics() {
    return this.clinics;
  }

  async getClinicById(id: string) {
    return this.clinics.find(c => c.id === id);
  }

  async createClinic(data: Omit<Clinic, 'id'>) {
    const clinic = { ...data, id: uuidv4() };
    this.clinics.push(clinic);
    this.saveToDisk();
    return clinic;
  }

  async updateClinic(id: string, updates: Partial<Omit<Clinic, 'id'>>) {
    const clinic = this.clinics.find(c => c.id === id);
    if (clinic) {
      Object.assign(clinic, updates);
      this.saveToDisk();
    }
    return clinic;
  }

  async deleteClinic(id: string) {
    const idx = this.clinics.findIndex(c => c.id === id);
    if (idx >= 0) {
      const [removed] = this.clinics.splice(idx, 1);
      this.saveToDisk();
      return removed;
    }
    return null;
  }

  // Patients
  async getPatientById(id: string) {
    return this.patients.find(p => p.id === id);
  }

  async findPatientByFileNo(fileNo: string) {
    return this.patients.find(p => p.file_no === fileNo);
  }

  async createPatient(data: Omit<Patient, 'id'>) {
    const newPatient = { ...data, id: uuidv4() };
    this.patients.push(newPatient);
    this.saveToDisk();
    return newPatient;
  }

  // Appointments
  async getAppointmentById(id: string) {
    const apt = this.appointments.find(a => a.id === id);
    if (apt) {
        // Join with patient
        const patient = this.patients.find(p => p.id === apt.patient_id);
        return { ...apt, patient };
    }
    return null;
  }

  async getAppointmentsByPatientId(patientId: string) {
      const apts = this.appointments.filter(a => a.patient_id === patientId);
      // Sort by date desc
      return apts.sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
  }

  async createAppointment(data: Omit<Appointment, 'id' | 'status'>) {
    const newAppointment: Appointment = {
      ...data,
      id: uuidv4(),
      status: 'booked',
      reminder_sent: false,
      visit_type: data.visit_type || 'scheduled'
    };
    this.appointments.push(newAppointment);
    this.saveToDisk();
    return newAppointment;
  }

  async getAppointmentsByClinic(clinicId: string, date: string) {
    return this.appointments.filter(a => 
      a.clinic_id === clinicId && a.scheduled_time.startsWith(date)
    );
  }

  async getAllAppointments() {
    // Join with patient data
    return this.appointments.map(a => {
        const patient = this.patients.find(p => p.id === a.patient_id);
        const clinic = this.clinics.find(c => c.id === a.clinic_id);
        return { ...a, patient, clinic_name: clinic?.name };
    });
  }

  async findAppointmentByTicket(ticketCode: string) {
    const apt = this.appointments.find(a => a.ticket_code === ticketCode);
    if (apt) {
         apt.patient = this.patients.find(p => p.id === apt.patient_id);
    }
    return apt;
  }

  async findAppointmentsByPhone(phone: string) {
      // Find patient(s) with this phone (usually unique, but handling potential dupes)
      const patients = this.patients.filter(p => p.phone === phone);
      const patientIds = patients.map(p => p.id);
      
      const apts = this.appointments.filter(a => patientIds.includes(a.patient_id));
      
      // Enrich
      return apts.map(a => ({
          ...a,
          patient: patients.find(p => p.id === a.patient_id),
          clinic_name: this.clinics.find(c => c.id === a.clinic_id)?.name
      }));
  }

  async updateAppointmentNotes(id: string, notes: string) {
      const apt = this.appointments.find(a => a.id === id);
      if (apt) {
          apt.consultation_notes = notes;
          this.saveToDisk();
      }
      return apt;
  }

  async updateAppointmentStatus(id: string, status: Appointment['status']) {
    const apt = this.appointments.find(a => a.id === id);
    if (apt) {
        apt.status = status;
        this.saveToDisk();
    }
    return apt;
  }

  async getUpcomingAppointments(windowMinutes: number) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowMinutes * 60000);
    return this.appointments.filter(a => {
      const when = new Date(a.scheduled_time);
      return a.status === 'booked' && when >= now && when <= windowEnd && !a.reminder_sent;
    }).map(a => ({
      ...a,
      patient: this.patients.find(p => p.id === a.patient_id)
    }));
  }

  async markReminderSent(id: string) {
    const apt = this.appointments.find(a => a.id === id);
    if (apt) {
      apt.reminder_sent = true;
      this.saveToDisk();
    }
    return apt;
  }

  // Queue Management
  async addToQueue(data: Omit<QueueEntry, 'id' | 'status' | 'arrival_time'>) {
      const newEntry: QueueEntry = {
          ...data,
          id: uuidv4(),
          status: 'waiting',
          arrival_time: new Date(),
          notified_next: false
      };
      this.queue.push(newEntry);
      
      // Update appointment status if linked
      if (data.appointment_id) {
          const apt = this.appointments.find(a => a.id === data.appointment_id);
          if (apt) {
              apt.status = 'checked_in';
          }
      }
      
      this.saveToDisk();
      return newEntry;
  }

  async getQueueByClinic(clinicId: string) {
      // Filter out 'done' and 'no_show' from active queue view
      return this.queue.filter(q => q.clinic_id === clinicId && q.status !== 'done' && q.status !== 'no_show');
  }

  async getAllQueueEntries() {
      return this.queue;
  }

  async updateQueueStatus(id: string, status: QueueEntry['status'], opts?: { doctor_id?: string }) {
      const entry = this.queue.find(q => q.id === id);
      if (entry) {
          entry.status = status;
          if (status === 'serving') entry.service_start_time = new Date();
          if (status === 'done') {
            entry.service_end_time = new Date();
            if (opts?.doctor_id) entry.doctor_id = opts.doctor_id;
          }
          
          this.saveToDisk();
      }
      return entry;
  }

  async getDoctorServiceStats(range: 'daily'|'weekly'|'monthly') {
    const now = new Date();
    let start = new Date(now);
    if (range === 'daily') {
      start.setHours(0,0,0,0);
    } else if (range === 'weekly') {
      start = new Date(now.getTime() - 7*24*60*60*1000);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
    }
    const done = this.queue.filter(q => q.status === 'done' && q.service_end_time && q.service_end_time >= start && q.doctor_id);
    const counts: Record<string, number> = {};
    done.forEach(q => { if (q.doctor_id) counts[q.doctor_id] = (counts[q.doctor_id] || 0) + 1; });
    return Object.entries(counts).map(([doctor_id, count]) => ({
      doctor_id,
      doctor_name: this.users.find(u => u.id === doctor_id)?.full_name || 'Doctor',
      count
    }));
  }

  async markQueueNextNotified(id: string) {
    const entry = this.queue.find(q => q.id === id);
    if (entry) {
      entry.notified_next = true;
      this.saveToDisk();
    }
    return entry;
  }

  // Users
  async getUsers() { return this.users; }

  private hashPassword(password: string, salt: string) {
    const hash = scryptSync(password, salt, 64).toString('hex');
    return hash;
  }

  async createUser(data: { username: string; role: User['role']; password?: string; clinic_id?: string; full_name?: string; email?: string; phone?: string; profile_image?: string }) {
    const user: User = { id: uuidv4(), username: data.username, role: data.role, clinic_id: data.clinic_id, full_name: data.full_name, email: data.email, phone: data.phone, profile_image: data.profile_image, approved: true };
    if (data.password && data.password.length > 0) {
      const salt = randomBytes(16).toString('hex');
      user.password_salt = salt;
      user.password_hash = this.hashPassword(data.password, salt);
    }
    this.users.push(user);
    this.saveToDisk();
    return user;
  }

  async updateUser(id: string, updates: Partial<{ username: string; role: User['role']; password: string; clinic_id: string; full_name: string; email: string; phone: string; profile_image: string }>) {
    const user = this.users.find(u => u.id === id);
    if (user) {
      if (typeof updates.username === 'string') user.username = updates.username;
      if (typeof updates.role === 'string') user.role = updates.role as User['role'];
      if (typeof updates.password === 'string' && updates.password.length > 0) {
        const salt = randomBytes(16).toString('hex');
        user.password_salt = salt;
        user.password_hash = this.hashPassword(updates.password, salt);
      }
      if (typeof updates.clinic_id === 'string') user.clinic_id = updates.clinic_id;
      if (typeof updates.full_name === 'string') user.full_name = updates.full_name;
      if (typeof updates.email === 'string') user.email = updates.email;
      if (typeof updates.phone === 'string') user.phone = updates.phone;
      if (typeof updates.profile_image === 'string') user.profile_image = updates.profile_image;
      this.saveToDisk();
    }
    return user;
  }

  async findUserByUsername(username: string) {
    return this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  async findUserByFullName(fullName: string) {
    return this.users.find(u => (u.full_name || '').toLowerCase() === fullName.toLowerCase());
  }

  async getUserById(id: string) {
    return this.users.find(u => u.id === id) || null;
  }

  async deleteUser(id: string) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx >= 0) {
      const [removed] = this.users.splice(idx, 1);
      this.saveToDisk();
      return removed;
    }
    return null;
  }

  // Audit Logs
  async addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const log: AuditLog = { id: uuidv4(), timestamp: new Date().toISOString(), ...entry };
    this.auditLogs.unshift(log);
    this.saveToDisk();
    return log;
  }

  async getAuditLogs(limit = 200) {
    return this.auditLogs.slice(0, limit);
  }

  async getSettings() {
    return this.settings;
  }

  async updateSettings(updates: Partial<Settings>) {
    const prev = { ...this.settings };
    this.settings = { ...this.settings, ...updates };
    if (updates.auto_approve_signups === true && prev.auto_approve_signups !== true) {
      let changed = false;
      this.users.forEach(u => {
        if (u.approved === false) {
          u.approved = true;
          changed = true;
        }
      });
      if (changed) this.saveToDisk();
    } else {
      this.saveToDisk();
    }
    return this.settings;
  }

  async getSiteConfig() {
    return this.siteConfig;
  }

  async updateSiteConfig(updates: Partial<SiteConfig>) {
    this.siteConfig = { ...this.siteConfig, ...updates };
    this.saveToDisk();
    return this.siteConfig;
  }

  async generateWalkInTicketNumber(clinicId: string) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const todayWalkIns = this.appointments.filter(a => 
        a.clinic_id === clinicId && 
        a.visit_type === 'walk-in' &&
        a.scheduled_time.startsWith(today)
    );
    
    const count = todayWalkIns.length + 1;
    return `W-${count.toString().padStart(3, '0')}`;
  }
}

export const db = new MockDB();
