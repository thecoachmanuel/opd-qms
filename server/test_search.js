// Testing with native fetch
const BASE_URL = 'http://localhost:5000/api';

async function testSearch() {
    console.log('Testing Appointment Search...');

    // 1. Search by Phone (using data from test_booking.js if it ran, or existing mock data)
    // In mockDb.ts, we usually have some seeded data or the one we just created "555-0199"
    
    try {
        const phone = '555-0199'; 
        console.log(`Searching by phone: ${phone}`);
        const resPhone = await fetch(`${BASE_URL}/appointments/search?type=phone&query=${phone}`);
        const dataPhone = await resPhone.json();
        
        if (resPhone.ok) {
            console.log(`Found ${dataPhone.length} appointments for phone ${phone}`);
            if (dataPhone.length > 0) {
                console.log('Sample:', dataPhone[0].ticket_code, dataPhone[0].status);
            }
        } else {
            console.error('Phone search failed:', dataPhone);
        }

        // 2. Search by Ticket
        // If we found one above, use its ticket
        if (dataPhone.length > 0) {
            const ticket = dataPhone[0].ticket_code;
            console.log(`Searching by ticket: ${ticket}`);
            const resTicket = await fetch(`${BASE_URL}/appointments/search?type=ticket&query=${ticket}`);
            const dataTicket = await resTicket.json();
            
            if (resTicket.ok && dataTicket.length > 0) {
                console.log('Found appointment by ticket:', dataTicket[0].ticket_code);
            } else {
                console.error('Ticket search failed or empty');
            }
        }

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testSearch();
