// Test Self Check-in Flow
const BASE_URL = 'http://localhost:5000/api';

async function testCheckIn() {
    console.log('Testing Self Check-in...');

    // 1. Book an Appointment to get a fresh ticket
    const now = new Date();
    // Book for next hour
    now.setHours(now.getHours() + 1);
    const slotTime = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

    const bookingPayload = {
        fileNo: 'TEST-CI-' + Date.now(),
        fullName: 'CheckIn Tester',
        phone: '555-CHECKIN',
        clinicId: 'c1', // General Medicine
        slotTime: slotTime
    };

    try {
        console.log('Booking appointment...');
        const bookRes = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingPayload)
        });
        const bookData = await bookRes.json();

        if (!bookRes.ok) {
            console.error('Booking failed:', bookData);
            return;
        }

        const ticket = bookData.appointment.ticket_code;
        console.log(`Booked! Ticket: ${ticket}`);

        // 2. Perform Self Check-in
        console.log(`Attempting self check-in for ${ticket}...`);
        const checkInRes = await fetch(`${BASE_URL}/queue/self-check-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketCode: ticket })
        });
        const checkInData = await checkInRes.json();

        if (checkInRes.ok) {
            console.log('Check-in successful!');
            console.log('Queue Entry:', checkInData.entry);
        } else {
            console.error('Check-in failed:', checkInData);
        }

        // 3. Verify Queue Status
        console.log('Verifying queue status...');
        const queueRes = await fetch(`${BASE_URL}/queue/c1`);
        const queueData = await queueRes.json();
        
        const found = queueData.queue.find(q => q.ticket_number === ticket);
        if (found) {
            console.log(`Ticket ${ticket} found in queue with status: ${found.status}`);
        } else {
            console.error(`Ticket ${ticket} NOT found in queue!`);
        }

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testCheckIn();
