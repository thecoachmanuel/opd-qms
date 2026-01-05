// Testing with native fetch


async function testBooking() {
    const BASE_URL = 'http://localhost:5000/api';
    
    try {
        // 1. Get Clinics
        console.log('Fetching clinics...');
        const clinicsRes = await fetch(`${BASE_URL}/clinics`);
        const clinics = await clinicsRes.json();
        const clinicId = clinics[0].id;
        console.log(`Using Clinic: ${clinics[0].name} (${clinicId})`);

        // 2. Pick a date (Tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        console.log(`Testing Date: ${dateStr}`);

        // 3. Get Slots (Initial)
        console.log('Fetching initial slots...');
        const slotsRes1 = await fetch(`${BASE_URL}/appointments/slots?clinicId=${clinicId}&date=${dateStr}`);
        const slots1 = await slotsRes1.json();
        console.log(`Available Slots: ${slots1.length}`);
        
        if (slots1.length === 0) {
            console.error('No slots available to test!');
            return;
        }

        const slotToBook = slots1[0]; // e.g., "08:00"
        console.log(`Attempting to book slot: ${slotToBook}`);

        // 4. Book Appointment
        // Need to construct ISO string for backend? 
        // Backend route expects: fileNo, fullName, phone, clinicId, slotTime
        // In BookAppointment.tsx: const fullTimestamp = `${formData.date}T${formData.slotTime}:00`;
        const fullTimestamp = `${dateStr}T${slotToBook}:00`;
        
        const bookingPayload = {
            fileNo: 'TEST-001',
            fullName: 'Test Patient',
            phone: '555-0199',
            clinicId: clinicId,
            slotTime: fullTimestamp
        };

        const bookRes = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingPayload)
        });

        if (!bookRes.ok) {
            const err = await bookRes.text();
            throw new Error(`Booking failed: ${err}`);
        }
        
        const bookData = await bookRes.json();
        console.log('Booking Successful:', bookData.appointment.ticket_code);

        // 5. Verify Slot is Gone
        console.log('Verifying slot is removed...');
        const slotsRes2 = await fetch(`${BASE_URL}/appointments/slots?clinicId=${clinicId}&date=${dateStr}`);
        const slots2 = await slotsRes2.json();
        
        if (!slots2.includes(slotToBook)) {
            console.log('SUCCESS: Slot is no longer available!');
        } else {
            console.error('FAILURE: Slot is still available!');
        }

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testBooking();
