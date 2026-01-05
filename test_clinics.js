async function testClinics() {
  try {
    const response = await fetch('http://localhost:5000/api/clinics');
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Data:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testClinics();
