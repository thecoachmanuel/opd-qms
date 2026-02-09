import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ---------------------
// 1. Clinics & Slots
// ---------------------

export const getClinics = async () => {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
};

// Slots logic remains mostly client-side calculator unless you store specific slots.
// For now, we simulate "available" by checking existing appointments for the day.
export const getSlots = async (clinicId: string, date: string) => {
  // 1. Get clinic details (hours)
  const { data: clinic } = await supabase.from('clinics').select('*').eq('id', clinicId).single();
  if (!clinic) throw new Error('Clinic not found');

  // 2. Get existing appointments
  // Supabase date filter: scheduled_time >= date 00:00 AND < date+1 00:00
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('scheduled_time')
    .eq('clinic_id', clinicId)
    .gte('scheduled_time', startOfDay.toISOString())
    .lt('scheduled_time', endOfDay.toISOString())
    .neq('status', 'cancelled');

  // 3. Generate all slots based on active_hours
  // Assuming active_hours format "08:00 - 17:00" or "08:00-17:00"
  const parts = (clinic.active_hours || "09:00-17:00").split('-');
  const startStr = parts[0].trim();
  const endStr = parts[1] ? parts[1].trim() : "17:00"; // Fallback if format is weird

  const slots: string[] = [];
  let current = new Date(`${date}T${startStr}`);
  const end = new Date(`${date}T${endStr}`);
  const interval = 15; // minutes
  const now = new Date();

  // Validation to prevent infinite loops or invalid dates
  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current >= end) {
      console.error('Invalid active_hours for clinic:', clinic.active_hours);
      return [];
  }

  while (current < end) {
    // Check if slot is in the past (only relevant if date is today)
    if (current < now) {
      current.setMinutes(current.getMinutes() + interval);
      continue;
    }

    const slotIso = current.toISOString();
    // Check if booked
    const isBooked = appointments?.some(app => {
        const appTime = new Date(app.scheduled_time);
        return Math.abs(appTime.getTime() - current.getTime()) < 60000; // within 1 min
    });

    if (!isBooked) {
        slots.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }
    current.setMinutes(current.getMinutes() + interval);
  }
  
  return slots;
};

// ---------------------
// 2. Appointments
// ---------------------

export const bookAppointment = async (data: any) => {
  // Use the secure RPC for public booking to handle patient creation and appointment booking atomically
  // This bypasses RLS issues for anonymous users and handles "find or create" logic for patients
  const { data: result, error } = await supabase.rpc('public_book_appointment', {
      p_clinic_id: data.clinicId,
      p_scheduled_time: data.slotTime,
      p_patient_full_name: data.fullName,
      p_patient_phone: data.phone,
      p_patient_email: data.email || null,
      p_patient_file_no: data.fileNo || null,
      p_notify_sms: data.notifySms || false,
      p_notify_email: data.notifyEmail || false
  });

  if (error) {
      console.error('Booking failed:', error);
      throw error;
  }

  return {
      appointment: {
          id: result.appointment_id,
          ticket_code: result.ticket_code,
          scheduled_time: result.scheduled_time,
          status: 'booked'
      },
      patient: {
          id: result.patient_id,
          file_no: result.file_no
      }
  };
};

export const sendBookingConfirmationEmail = async (data: {
    email: string;
    fullName: string;
    ticketCode: string;
    scheduledTime: string;
    clinicName: string;
    checkInUrl: string;
}) => {
    try {
        const { error } = await supabase.functions.invoke('send-ticket', {
            body: data
        });
        if (error) throw error;
    } catch (err) {
        console.error('Failed to send confirmation email:', err);
        // We don't throw here because the booking itself was successful, 
        // and we don't want to show a failure screen just because email failed.
    }
};

export const getAllAppointments = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
        *,
        patients (full_name, file_no, phone),
        clinics (name)
    `)
    .order('scheduled_time', { ascending: false });
    
  if (error) throw error;
  return data;
};

export const searchAppointments = async (type: 'ticket' | 'phone', query: string) => {
  // Use enhanced RPC to search both appointments and queue
  const { data, error } = await supabase.rpc('search_public_status', {
    p_type: type,
    p_query: query
  });

  if (error) throw error;
  return data;
};

export const getAppointmentById = async (id: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
        *,
        patients (*),
        clinics (*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const getPatientHistory = async (patientId: string) => {
    const { data, error } = await supabase
        .from('appointments')
        .select(`
            *,
            clinics (name)
        `)
        .eq('patient_id', patientId)
        .order('scheduled_time', { ascending: false });
    if (error) throw error;
    return data;
};

export const cancelAppointment = async (id: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ---------------------
// 3. Queue Management
// ---------------------

export const getQueueStatus = async (clinicId: string) => {
  // Real-time subscription will be handled in the component via supabase.channel
  // This is the initial fetch
  const { data: queue, error } = await supabase
    .from('queue')
    .select(`
        *,
        profiles:doctor_id (full_name)
    `)
    .eq('clinic_id', clinicId)
    .neq('status', 'done')
    .neq('status', 'no_show') // Usually we only want active queue
    .order('arrival_time', { ascending: true });

  if (error) throw error;

  const serving = queue.find(q => q.status === 'serving');
  const waiting = queue.filter(q => q.status === 'waiting');
  const waitTime = waiting.length * 15; // Estimate

  return {
    queue,
    currentServing: serving,
    totalWaiting: waiting.length,
    waitTime
  };
};

export const checkIn = async (data: any) => {
  // 1. If appointment exists, update it
  if (data.appointment_id) {
      await supabase.from('appointments').update({ status: 'checked_in' }).eq('id', data.appointment_id);
  }

  // 2. Prepare Ticket Number
  let ticketNumber = data.ticket_number;

  if (!ticketNumber) {
    // Generate consecutive walk-in number
    // We count how many 'W-%' tickets exist for this clinic today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count, error: countErr } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', data.clinic_id)
        .ilike('ticket_number', 'W-%')
        .gte('created_at', startOfDay.toISOString());
    
    if (countErr) {
        console.error('Failed to count walk-ins', countErr);
        // Fallback to random if count fails
        ticketNumber = `W-${Math.floor(Math.random() * 1000)}`;
    } else {
        const nextNum = (count || 0) + 1;
        ticketNumber = `W-${nextNum.toString().padStart(3, '0')}`;
    }
  }

  // 3. Add to Queue
  const { data: entry, error } = await supabase
    .from('queue')
    .insert({
        clinic_id: data.clinic_id,
        appointment_id: data.appointment_id,
        ticket_number: ticketNumber,
        patient_name: data.patient_name,
        status: 'waiting',
        arrival_time: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return entry;
};

// Self Check-in logic (simplified)
export const selfCheckIn = async (ticketCode: string, coords?: { latitude: number; longitude: number }) => {
    // 1. Verify Appointment
    const { data: appointment } = await supabase
        .from('appointments')
        .select('*, clinics(*), patients(*)')
        .eq('ticket_code', ticketCode)
        .single();
    
    if (!appointment) throw new Error('Invalid ticket');
    
    // 2. Geofence Check (optional - fetch settings first)
    if (coords) {
        const { data: settings } = await supabase.from('settings').select('*').single();
        if (settings && settings.hospital_latitude && settings.hospital_longitude) {
            // Calculate distance... (omitted for brevity, can import util)
        }
    }

    // 3. Add to queue
    return checkIn({
        clinic_id: appointment.clinic_id,
        appointment_id: appointment.id,
        ticket_number: appointment.ticket_code,
        patient_name: appointment.patients?.full_name || 'Self Checked-in'
    });
};

export const getQueueSettings = async () => {
    const { data, error } = await supabase.from('settings').select('*').single();
    if (error) return { hospital_location: undefined, geofence_radius_km: 0.5 };
    
    return {
        hospital_location: data.hospital_latitude ? { latitude: data.hospital_latitude, longitude: data.hospital_longitude } : undefined,
        geofence_radius_km: data.geofence_radius_km
    };
};

// ---------------------
// Site Configuration
// ---------------------

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
    logo_url: string;
  };
  footer: {
    brand_description: string;
    contact_address: string;
    contact_phone: string;
    contact_email: string;
    social_links: {
      facebook: string;
      twitter: string;
      instagram: string;
      linkedin: string;
    };
  };
  meta: {
    site_title: string;
    site_description: string;
    keywords: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
}

export const getSiteConfig = async (): Promise<SiteConfig> => {
    // Default fallback config
    const defaultConfig: SiteConfig = {
      hero: {
        title: 'Out-Patient Queue',
        subtitle: 'Management System',
        description: 'Streamline your hospital visit. Book appointments, check live queue status, and save time.',
        cta_primary_text: 'Book Appointment',
        cta_primary_link: '/book',
        cta_secondary_text: 'Self Check-in',
        cta_secondary_link: '/check-in',
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
      },
      location: {
        latitude: 6.5965,
        longitude: 3.3553,
        radius_km: 0.5
      }
    };

    try {
        const { data, error } = await supabase.from('settings').select('*').single();
        if (error || !data) {
            return defaultConfig;
        }
        
        const siteConfig = data.site_config || {};
        
        return { 
            ...defaultConfig, 
            ...siteConfig,
            location: {
                latitude: data.hospital_latitude !== undefined ? data.hospital_latitude : defaultConfig.location?.latitude,
                longitude: data.hospital_longitude !== undefined ? data.hospital_longitude : defaultConfig.location?.longitude,
                radius_km: data.geofence_radius_km !== undefined ? data.geofence_radius_km : defaultConfig.location?.radius_km
            }
        };
    } catch (e) {
        console.warn('Failed to fetch site config, using default. Error:', e);
        return defaultConfig;
    }
};

export const updateSiteConfig = async (updates: Partial<SiteConfig>) => {
    const current = await getSiteConfig();
    
    // Separate location from other config
    const { location, ...otherUpdates } = updates;
    
    // Deep merge updates for JSON config
    const newConfig = {
        ...current,
        ...otherUpdates,
        hero: { ...current.hero, ...(otherUpdates.hero || {}) },
        header: { ...current.header, ...(otherUpdates.header || {}) },
        footer: { ...current.footer, ...(otherUpdates.footer || {}) },
        meta: { ...current.meta, ...(otherUpdates.meta || {}) },
    };
    
    // Remove location from the JSON object we are about to save
    const configToSave = { ...newConfig };
    delete configToSave.location;

    const dbUpdates: any = {
        site_config: configToSave
    };
    
    // Add location fields if they are being updated
    if (location) {
        dbUpdates.hospital_latitude = location.latitude;
        dbUpdates.hospital_longitude = location.longitude;
        dbUpdates.geofence_radius_km = location.radius_km;
    } else if (updates.location) {
         // If location was passed but might be partial? 
         // For now assuming full object replacement for location or nothing
    }

    const { data: existing } = await supabase.from('settings').select('id').single();
    
    if (existing) {
         const { error } = await supabase
            .from('settings')
            .update(dbUpdates)
            .eq('id', existing.id);
         if (error) throw error;
    } else {
         const { error } = await supabase
            .from('settings')
            .insert(dbUpdates);
         if (error) throw error;
    }

    return {
        ...newConfig,
        location: location || current.location
    };
};

export const ensureUserProfile = async (user: any) => {
    if (!user || !user.id) return;

    // Check if profile exists
    const { data, error } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    
    // If found, we are good
    if (data) return;

    // If error is not "row not found", log it but proceed to try creation as fallback
    if (error && error.code !== 'PGRST116') {
        console.warn('Error checking profile existence:', error);
    }

    console.log('Profile missing for user, attempting to auto-create...', user.id);
    
    // Create profile
    const { error: createError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.substring(0,6)}`,
        full_name: user.user_metadata?.full_name || 'System User',
        role: user.user_metadata?.role || 'staff',
        clinic_id: user.user_metadata?.clinic_id,
        approved: typeof user.user_metadata?.approved === 'boolean' ? user.user_metadata.approved : false
    });

    if (createError) {
        console.error('Failed to auto-create profile:', createError);
        throw createError;
    }
};

// Staff Actions
export const updateQueueStatus = async (id: string, status: 'serving' | 'done' | 'no_show', clinicId?: string, notes?: string, role?: string, userId?: string) => {
    const updates: any = { status };
    if (status === 'serving') updates.service_start_time = new Date().toISOString();
    if (status === 'done') updates.service_end_time = new Date().toISOString();
    if (notes) updates.consultation_notes = notes;
    if (userId) updates.doctor_id = userId;

    const { data, error } = await supabase
        .from('queue')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
    if (error) throw error;

    // Audit Log
    logAudit('update_queue_status', { id, status, clinicId, notes });

    // Sync with Appointments if applicable
    try {
        if (data.appointment_id && (status === 'done' || status === 'no_show')) {
            const appStatus = status === 'done' ? 'completed' : 'no_show';
            const appUpdates: any = { status: appStatus };
            if (notes) appUpdates.consultation_notes = notes;
            
            const { error: appError } = await supabase
                .from('appointments')
                .update(appUpdates)
                .eq('id', data.appointment_id);
                
            if (appError) {
                console.error('Failed to sync appointment status:', appError);
                // We don't throw here to avoid rolling back the queue status update
                // forcing the doctor to retry "Complete" when the queue is already "done" would be confusing.
            }
        }
    } catch (syncErr) {
        console.error('Unexpected error during appointment sync:', syncErr);
    }

    return data;
};

export const deleteQueueItem = async (id: string) => {
    const { error } = await supabase.from('queue').delete().eq('id', id);
    if (error) throw error;
    logAudit('delete_queue_item', { id });
    return true;
};

// ---------------------
// 4. Admin
// ---------------------

export const adminGetClinics = getClinics;

export const adminCreateClinic = async (data: any) => {
    const { data: clinic, error } = await supabase.from('clinics').insert(data).select().single();
    
    if (error) {
        // Fallback: If theme_color column is missing, retry without it
        if (data.theme_color && error.message?.includes('theme_color')) {
            console.warn('theme_color column missing, retrying without it');
            const { theme_color, ...rest } = data;
            const { data: clinicRetry, error: errorRetry } = await supabase.from('clinics').insert(rest).select().single();
            if (errorRetry) throw errorRetry;
            
            logAudit('create_clinic', { clinic_id: clinicRetry.id, name: rest.name });
            return clinicRetry;
        }
        throw error;
    }
    
    logAudit('create_clinic', { clinic_id: clinic.id, name: data.name });
    return clinic;
};

export const adminUpdateClinic = async (id: string, data: any) => {
    const { data: clinic, error } = await supabase.from('clinics').update(data).eq('id', id).select().single();
    
    if (error) {
         // Fallback: If theme_color column is missing, retry without it
         if (data.theme_color && error.message?.includes('theme_color')) {
             console.warn('theme_color column missing, retrying without it');
             const { theme_color, ...rest } = data;
             const { data: clinicRetry, error: errorRetry } = await supabase.from('clinics').update(rest).eq('id', id).select().single();
             if (errorRetry) throw errorRetry;
             
             logAudit('update_clinic', { clinic_id: id, updates: rest });
             return clinicRetry;
         }
         throw error;
    }
    
    logAudit('update_clinic', { clinic_id: id, updates: data });
    return clinic;
};

export const adminDeleteClinic = async (id: string) => {
    const { error } = await supabase.from('clinics').delete().eq('id', id);
    if (error) throw error;
    logAudit('delete_clinic', { clinic_id: id });
    return true;
};

export const adminDeleteAppointment = async (id: string) => {
    // Check if it's a queue-only item (prefixed with 'queue-')
    if (id.startsWith('queue-')) {
        const queueId = id.replace('queue-', '');
        return deleteQueueItem(queueId);
    }
    
    // 1. Delete associated queue item(s) first to prevent them becoming orphans/walk-ins
    // (Even though ON DELETE SET NULL exists, we want to remove the analytics data completely)
    await supabase.from('queue').delete().eq('appointment_id', id);

    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
    logAudit('delete_appointment', { appointment_id: id });
    return true;
};

export const adminGetUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data;
};

export const adminSyncUsers = async () => {
    const { data, error } = await supabase.rpc('admin_sync_users_rpc');
    if (error) throw error;
    return data;
};

export const getEmailByUsername = async (username: string) => {
    // Use the secure RPC function to bypass RLS for public username lookup
    const { data, error } = await supabase.rpc('get_email_by_username', {
        username_input: username
    });

    if (error) {
        console.error('Error resolving username:', error);
        throw error;
    }
    
    return data;
};

// Authentication
export const authLogin = async (email: string, password: string) => {
    let data: any;
    let error: any;

    // Retry login logic for transient Auth errors
    for (let i = 0; i < 3; i++) {
        try {
            const result = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            data = result.data;
            error = result.error;

            if (!error) break;

            // Don't retry for definitive auth failures
            if (error.message === 'Invalid login credentials' || 
                error.status === 400 || 
                (error as any).code === 'invalid_credentials') {
                break;
            }
            
            console.warn(`Login attempt ${i+1} failed with transient error:`, error.message);
        } catch (err: any) {
            error = err;
            console.warn(`Login attempt ${i+1} threw exception:`, err.message);
        }
        
        // Wait 1s before retry
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (error) throw error;

    if (data && data.user) {
        // Retry logic for fetching profile
        let profile = null;
        let profileError: any = null;
        
        for (let i = 0; i < 3; i++) {
            try {
                const result = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();
                
                if (!result.error) {
                    profile = result.data;
                    profileError = null;
                    break;
                } else {
                    profileError = result.error;
                    // If row missing (PGRST116), don't retry, it won't appear magically
                    if (result.error.code === 'PGRST116') break;
                }
            } catch (err) {
                profileError = err;
            }
            // Wait 1s before retry
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (profileError) {
            console.error('Error fetching user profile after retries:', profileError);
            
            // FALLBACK: If we have user metadata, use it temporarily to allow login
            // This handles cases where DB is flaky but Auth is fine.
            // Expanded to handle 'unexpected_failure', generic schema errors, AND missing profile (PGRST116)
            const isRecoverableError = profileError.code === 'PGRST200' || 
                                  profileError.code === 'unexpected_failure' ||
                                  profileError.code === 'PGRST116' ||
                                  profileError.message?.includes('schema') ||
                                  profileError.message?.includes('unexpected') ||
                                  profileError.message?.includes('JSON');

            if (data.user && isRecoverableError) {
                console.warn('Using fallback profile due to database error/missing profile:', profileError.message);
                const meta = data.user.user_metadata || {};
                
                const fallbackProfile = {
                    id: data.user.id,
                    username: meta.username || data.user.email?.split('@')[0] || 'user',
                    full_name: meta.full_name || 'User',
                    role: meta.role || 'staff', // Default role if missing
                    clinic_id: meta.clinic_id,
                    email: data.user.email,
                    approved: true
                };

                // Attempt to auto-heal/sync the profile to the database
                // This ensures they show up in Admin Dashboard later
                try {
                    await supabase.from('profiles').upsert(fallbackProfile);
                } catch (syncErr) {
                    console.warn('Failed to auto-sync profile during fallback login:', syncErr);
                }

                return fallbackProfile;
            }

            throw profileError;
        }
        
        return profile;
    }
    
    throw new Error('Login failed');
};

export const authSignup = async (data: {
    email: string;
    password: string;
    username: string;
    full_name: string;
    role: 'admin' | 'staff' | 'doctor';
    clinic_id: string;
    phone?: string;
}) => {
    // 0. Check Auto-Approve Setting
    let isApproved = false;
    try {
        const { data: settings } = await supabase.from('settings').select('auto_approve_signups').single();
        if (settings && settings.auto_approve_signups) {
            isApproved = true;
        }
    } catch (e) {
        console.warn('Failed to fetch settings for signup approval, defaulting to pending:', e);
    }

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                username: data.username,
                full_name: data.full_name,
                role: data.role,
                clinic_id: data.clinic_id,
                approved: isApproved
            }
        }
    });

    if (authError) throw authError;

    if (authData.user) {
        // 2. Create Profile entry (if not handled by trigger)
        // Try/catch wrapper for profile creation to prevent signup failure if profile fails
        try {
             // Let's try inserting into profiles.
             // Use upsert to be safe against Triggers that might have already created the profile
             const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    username: data.username,
                    full_name: data.full_name,
                    role: data.role,
                    clinic_id: data.clinic_id,
                    email: data.email,
                    phone: data.phone,
                    approved: isApproved
                })
                .select()
                .single();
                
             if (profileError) {
                 console.error('Profile creation failed (non-critical if metadata exists):', profileError);
                 // We don't throw here anymore because the User is already created in Auth.
                 // Throwing would confuse the user into trying to signup again (which would fail with "User already registered").
                 // Instead, we return a constructed profile object so the UI thinks it succeeded.
                 // The "Login" logic will fallback to metadata anyway.
                 return {
                    id: authData.user.id,
                    username: data.username,
                    full_name: data.full_name,
                    role: data.role,
                    clinic_id: data.clinic_id,
                    email: data.email,
                    approved: isApproved
                 };
             }
            
            return profile;
        } catch (profileErr) {
             console.error('Profile creation exception:', profileErr);
             // Return fallback profile
             return {
                id: authData.user.id,
                username: data.username,
                full_name: data.full_name,
                role: data.role,
                clinic_id: data.clinic_id,
                email: data.email,
                approved: isApproved
             };
        }
    }
    
    throw new Error('Signup failed');
};

// Creating a user in Supabase usually requires Admin Auth API or just inviting them.
// For this demo, we'll assume we just create a profile, but in reality, you need to create the Auth User first.
// Since client-side can't create other users easily without Service Role, 
// this part might need a Supabase Edge Function or keeping a small Node server.
// For now, we will just return a placeholder or use a "rpc" call if we had one.
export const adminCreateUser = async (data: any) => {
    // Generate email if not provided (fallback)
    const email = data.email || `${data.username.toLowerCase().replace(/\s+/g, '')}@lasuth.org.ng`;
  
    // 1. Create a temporary client to avoid logging out the admin
    // This mocks the user signup process (sending email confirmation if enabled)
    const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL, 
        import.meta.env.VITE_SUPABASE_ANON_KEY, 
        {
            auth: {
                persistSession: false, // Critical: Do not overwrite admin session
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );

    // 2. Sign up the user (triggers email confirmation flow)
    const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: email,
        password: data.password,
        options: {
            data: {
                username: data.username,
                full_name: data.full_name,
                role: data.role,
                clinic_id: data.clinic_id,
            }
        }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // 3. Create Profile (using Admin privileges)
    // Even if user is unconfirmed, we can create their profile so it exists
    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
        clinic_id: data.clinic_id || null,
        email: email,
        phone: data.phone || null,
        approved: true // Auto-approve the profile (not the email)
    });

    if (profileError) {
        // If profile creation fails, we should probably warn or try to clean up
        console.error('Profile creation failed for new user:', profileError);
        throw profileError;
    }

    logAudit('create_user', { username: data.username, role: data.role, email_flow: true });
    return authData.user;
};

export const adminUpdateUser = async (id: string, data: any) => {
    // data contains updates. RPC expects (target_user_id, updates, new_password)
    // Extract password if present
    const { password, ...updates } = data;
    
    const { data: result, error } = await supabase.rpc('admin_update_user', {
        target_user_id: id,
        updates: updates,
        new_password: password || null
    });

    if (error) throw error;
    logAudit('update_user', { user_id: id, updates });
    return result;
};

export const adminDeleteUser = async (id: string) => {
    const { error } = await supabase.rpc('delete_user_by_id', {
        target_user_id: id
    });
    if (error) throw error;
    logAudit('delete_user', { user_id: id });
    return true;
};

export const adminGetAuditLogs = async () => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select(`
                *,
                profiles (username, full_name, role)
            `)
            .order('timestamp', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        return [];
    }
};

export const adminClearAuditLogs = async () => {
    const { error } = await supabase.rpc('clear_audit_logs');
    if (error) throw error;
    logAudit('clear_audit_logs', {});
    return true;
};

// Helper to log actions
export const logAudit = async (action: string, details: any = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fire and forget - don't await to avoid blocking UI
    supabase.from('audit_logs').insert({
        actor_id: user.id,
        action,
        details
    }).then(({ error }) => {
        if (error) console.error('Audit log error:', error);
    });
};

export const adminApproveUser = async (id: string) => {
    const { data, error } = await supabase.from('profiles').update({ approved: true }).eq('id', id).select().single();
    if (error) throw error;
    logAudit('approve_user', { user_id: id });
    return data;
};

export const adminGetSettings = async () => {
    const { data, error } = await supabase.from('settings').select('*').single();
    if (error) return { hospital_location: undefined, geofence_radius_km: 0.5, auto_approve_signups: false };
    
    return {
        hospital_location: data.hospital_latitude ? { latitude: data.hospital_latitude, longitude: data.hospital_longitude } : undefined,
        geofence_radius_km: data.geofence_radius_km,
        auto_approve_signups: data.auto_approve_signups || false
    };
};

export const adminUpdateSettings = async (data: any) => {
    // Map frontend structure to DB structure if needed
    const dbData: any = {};
    if (data.auto_approve_signups !== undefined) dbData.auto_approve_signups = data.auto_approve_signups;
    if (data.geofence_radius_km !== undefined) dbData.geofence_radius_km = data.geofence_radius_km;
    if (data.hospital_location) {
        dbData.hospital_latitude = data.hospital_location.latitude;
        dbData.hospital_longitude = data.hospital_location.longitude;
    }

    const { data: existing } = await supabase.from('settings').select('id').single();
    
    if (existing) {
         const { data: updated, error } = await supabase
            .from('settings')
            .update(dbData)
            .eq('id', existing.id)
            .select()
            .single();
         if (error) throw error;
         logAudit('update_settings', { updates: data });
         return updated;
    } else {
         const { data: newSetting, error } = await supabase
            .from('settings')
            .insert(dbData)
            .select()
            .single();
         if (error) throw error;
         logAudit('update_settings', { updates: data, new: true });
         return newSetting;
    }
};

export const adminGetDoctorStats = async () => {
    const now = new Date();
    // Calculate date boundaries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Find the earliest date to fetch from
    let earliest = sevenDaysAgo < monthStart ? sevenDaysAgo : monthStart;

    const { data, error } = await supabase
        .from('queue')
        .select(`
            doctor_id,
            service_end_time,
            profiles:doctor_id (full_name, username)
        `)
        .eq('status', 'done')
        .not('doctor_id', 'is', null)
        .gte('service_end_time', earliest.toISOString());

    if (error) {
        console.error('Error fetching doctor stats:', error);
        return [];
    }

    // Aggregate
    const stats: Record<string, any> = {};

    data.forEach((item: any) => {
        const did = item.doctor_id;
        if (!did) return;
        
        const time = new Date(item.service_end_time);
        const name = item.profiles?.full_name || item.profiles?.username || 'Unknown';

        if (!stats[did]) {
            stats[did] = { doctor_id: did, doctor_name: name, daily: 0, weekly: 0, monthly: 0 };
        }

        // Daily (Today)
        if (time >= todayStart) {
            stats[did].daily++;
        }
        // Weekly (Last 7 Days)
        if (time >= sevenDaysAgo) {
            stats[did].weekly++;
        }
        // Monthly (This Month)
        if (time >= monthStart) {
            stats[did].monthly++;
        }
    });

    return Object.values(stats);
};

export const adminGetQueueHistory = async () => {
    // Fetch queue items that might not have associated appointments
    const { data, error } = await supabase
        .from('queue')
        .select(`
            *,
            clinics (name)
        `)
        .order('arrival_time', { ascending: false });
        
    if (error) {
        console.error('Error fetching queue history:', error);
        return [];
    }
    return data;
};

// ---------------------
// 5. User & Profile
// ---------------------

export const getUserById = async (id: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
};

export const updateUserProfile = async (id: string, data: any) => {
    const { data: updated, error } = await supabase.from('profiles').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
};

export const updateOwnPassword = async (id: string, current: string, next: string) => {
    // Note: Supabase doesn't easily verify current password without re-login.
    // For now, we proceed with update.
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw error;
};

export const uploadSiteLogo = async (file: File): Promise<{ logo_url: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `site-logo-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
    return { logo_url: data.publicUrl };
};

export const removeSiteLogo = async (currentUrl?: string | null) => {
    if (currentUrl) {
        try {
            // Extract file path from URL
            // Format: .../storage/v1/object/public/assets/FILENAME
            const parts = currentUrl.split('/assets/');
            if (parts.length === 2) {
                const filePath = parts[1];
                await supabase.storage.from('assets').remove([filePath]);
            }
        } catch (err) {
            console.warn('Failed to cleanup old site logo:', err);
        }
    }
    return true;
};

export const uploadUserProfileImage = async (id: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `profile-${id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;
    
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    // Update profile
    await supabase.from('profiles').update({ profile_image: data.publicUrl }).eq('id', id);
    
    return { profile_image: data.publicUrl };
};

export const removeUserProfileImage = async (id: string, currentUrl?: string | null) => {
    // 1. If there's a current URL, try to delete the file from storage
    if (currentUrl) {
        try {
            // Extract file path from URL
            // Format: .../storage/v1/object/public/avatars/FILENAME
            const parts = currentUrl.split('/avatars/');
            if (parts.length === 2) {
                const filePath = parts[1];
                await supabase.storage.from('avatars').remove([filePath]);
            }
        } catch (err) {
            console.warn('Failed to cleanup old profile image:', err);
        }
    }

    // 2. Clear the field in profiles table
    const { error } = await supabase.from('profiles').update({ profile_image: null }).eq('id', id);
    if (error) throw error;
    
    return true;
};
