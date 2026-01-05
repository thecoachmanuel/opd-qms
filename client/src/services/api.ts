import axios from 'axios';

// Use relative URLs to leverage Vite Proxy (solves Mixed Content on HTTPS)
export const BASE_URL = '/api';
export const SOCKET_URL = '/';

const api = axios.create({
  baseURL: BASE_URL,
});

export const getClinics = async () => {
  const response = await api.get('/clinics');
  return response.data;
};

export const getSlots = async (clinicId: string, date: string) => {
    const response = await api.get('/appointments/slots', { params: { clinicId, date } });
    return response.data;
};

export const bookAppointment = async (data: any) => {
  const response = await api.post('/appointments/book', data);
  return response.data;
};

export const getAllAppointments = async () => {
    const response = await api.get('/appointments');
    return response.data;
};

export const searchAppointments = async (type: 'ticket' | 'phone', query: string) => {
    const response = await api.get('/appointments/search', { params: { type, query } });
    return response.data;
};

export const getAppointmentById = async (id: string) => {
    const response = await api.get(`/appointments/${id}`);
    return response.data;
};

export const getPatientHistory = async (patientId: string) => {
    const response = await api.get(`/appointments/patient/${patientId}`);
    return response.data;
};

export const cancelAppointment = async (id: string) => {
    const response = await api.put(`/appointments/${id}/cancel`);
    return response.data;
};

// Queue
export const getQueueStatus = async (clinicId: string) => {
    const response = await api.get(`/queue/${clinicId}`);
    return response.data;
};

export const checkIn = async (data: any) => {
    const response = await api.post('/queue/check-in', data);
    return response.data;
};

export const selfCheckIn = async (ticketCode: string, coords?: { latitude: number; longitude: number }) => {
    const response = await api.post('/queue/self-check-in', { ticketCode, latitude: coords?.latitude, longitude: coords?.longitude });
    return response.data;
};

export const getQueueSettings = async () => {
    const response = await api.get('/queue/settings/location');
    return response.data as { hospital_location?: { latitude: number; longitude: number }; geofence_radius_km: number };
};

// Staff
export const updateQueueStatus = async (id: string, status: 'serving' | 'done' | 'no_show', clinicId?: string, notes?: string, role?: string, userId?: string) => {
    const response = await api.patch(`/queue/${id}/status`, { status, clinicId, notes, role, userId });
    return response.data;
};

// Admin
export const adminGetClinics = async () => {
  const response = await api.get('/admin/clinics');
  return response.data;
};

export const adminCreateClinic = async (data: any) => {
  const response = await api.post('/admin/clinics', data);
  return response.data;
};

export const adminUpdateClinic = async (id: string, data: any) => {
  const response = await api.put(`/admin/clinics/${id}`, data);
  return response.data;
};

export const adminDeleteClinic = async (id: string) => {
  const response = await api.delete(`/admin/clinics/${id}`);
  return response.data;
};

export const adminGetUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const adminCreateUser = async (data: { username: string; full_name: string; role: 'admin' | 'staff' | 'doctor'; password: string; clinic_id?: string; email?: string; phone?: string }) => {
  const response = await api.post('/admin/users', data);
  return response.data;
};

export const adminUpdateUser = async (id: string, data: { username?: string; role?: 'admin' | 'staff' | 'doctor'; password?: string; clinic_id?: string; full_name?: string; email?: string; phone?: string }) => {
  const response = await api.put(`/admin/users/${id}`, data);
  return response.data;
};

export const adminApproveUser = async (id: string) => {
  const response = await api.put(`/admin/users/${id}/approve`);
  return response.data as { id: string; approved: boolean };
};

export const adminDeleteUser = async (id: string) => {
  const response = await api.delete(`/admin/users/${id}`);
  return response.data;
};

export const adminGetAuditLogs = async () => {
  const response = await api.get('/admin/audit-logs');
  return response.data;
};

export const adminGetSettings = async () => {
  const response = await api.get('/admin/settings');
  return response.data as { auto_approve_signups: boolean; hospital_location?: { latitude: number; longitude: number }; geofence_radius_km?: number };
};

export const adminUpdateSettings = async (data: { auto_approve_signups?: boolean; hospital_location?: { latitude: number; longitude: number }; geofence_radius_km?: number }) => {
  const response = await api.put('/admin/settings', data);
  return response.data as { auto_approve_signups: boolean; hospital_location?: { latitude: number; longitude: number }; geofence_radius_km?: number };
};

export const adminGetDoctorStats = async () => {
  const response = await api.get('/admin/stats/doctors');
  return response.data as Array<{ doctor_id: string; doctor_name: string; daily: number; weekly: number; monthly: number }>;
};

// Site Config
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

export const getSiteConfig = async () => {
  const response = await api.get('/admin/site-config');
  return response.data as SiteConfig;
};

export const updateSiteConfig = async (data: Partial<SiteConfig>) => {
  const response = await api.put('/admin/site-config', data);
  return response.data as SiteConfig;
};

// Auth
export const authLogin = async (username: string, password: string) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data as { id: string; username: string; full_name?: string; role: 'admin'|'staff'|'doctor'; clinic_id?: string|null };
};

export const authSignup = async (data: { username: string; full_name: string; role: 'admin'|'staff'|'doctor'; clinic_id: string; password: string; email?: string; phone?: string }) => {
  const response = await api.post('/auth/signup', data);
  return response.data as { id: string; username: string; role: 'admin'|'staff'|'doctor'; full_name: string; approved: boolean };
};

export const getUserById = async (id: string) => {
  const response = await api.get('/users/me', { params: { userId: id } });
  return response.data;
};

export const updateUserProfile = async (id: string, data: { full_name?: string; email?: string; phone?: string }) => {
  const response = await api.put('/users/me', { userId: id, ...data });
  return response.data;
};

export const updateOwnPassword = async (id: string, current_password: string, new_password: string) => {
  const response = await api.put('/users/me/password', { userId: id, current_password, new_password });
  return response.data;
};

export const uploadUserProfileImage = async (id: string, image_base64: string) => {
  const response = await api.put('/users/me/profile-image', { userId: id, image_base64 });
  return response.data as { success: boolean; profile_image: string };
};

export const uploadSiteLogo = async (image_base64: string) => {
  const response = await api.post('/admin/site-config/logo', { image_base64 });
  return response.data as { success: boolean; logo_url: string };
};

export default api;
