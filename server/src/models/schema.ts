import { query } from '../config/db';

export const createTables = async () => {
  try {
    // Patients Table
    await query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_no VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Clinics Table
    await query(`
      CREATE TABLE IF NOT EXISTS clinics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100),
        active_hours VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Appointments Table
    await query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id),
        clinic_id UUID REFERENCES clinics(id),
        scheduled_time TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'booked', -- booked, checked_in, completed, cancelled
        ticket_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Queue Table
    await query(`
      CREATE TABLE IF NOT EXISTS queue_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID REFERENCES appointments(id),
        clinic_id UUID REFERENCES clinics(id),
        ticket_number VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'waiting', -- waiting, serving, done
        arrival_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        service_start_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tables created successfully');
    
    // Seed dummy data if needed
    await seedData();

  } catch (err) {
    console.error('Error creating tables:', err);
  }
};

const seedData = async () => {
    // Check if clinics exist
    const res = await query('SELECT * FROM clinics');
    if (res.rows.length === 0) {
        await query(`
            INSERT INTO clinics (name, location, active_hours)
            VALUES 
            ('General OPD', 'Block A, Ground Floor', '08:00-16:00'),
            ('Cardiology', 'Block B, 2nd Floor', '09:00-14:00'),
            ('Pediatrics', 'Block C, 1st Floor', '08:00-16:00');
        `);
        console.log('Seed data inserted');
    }
}
