// Simple HMS initialization script
const axios = require('axios');

const BASE_URL = 'https://backend-morphvm-mkofwuzh.http.cloud.morph.so';

async function testConnection() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('Backend API is healthy:', response.data);
    return true;
  } catch (error) {
    console.error('Backend API not responding:', error.message);
    return false;
  }
}

async function createSampleHMSData() {
  try {
    // Test connection first
    if (!await testConnection()) {
      console.error('Cannot connect to backend API');
      return;
    }
    
    console.log('Creating sample HMS data...');
    
    // Create a medical record for an existing patient
    const medicalRecord = {
      patient_id: 'PT-MG72EVHV',  // Sarah Wilson from our CRM
      visit_type: 'routine_checkup',
      chief_complaint: 'Annual health checkup',
      history_of_present_illness: 'No current illness, routine examination',
      vital_signs: JSON.stringify({
        blood_pressure: '120/80',
        pulse: 72,
        temperature: '98.6F',
        respiratory_rate: 16,
        oxygen_saturation: '98%'
      }),
      physical_examination: 'Normal examination findings',
      assessment_plan: 'Continue current health maintenance plan',
      created_by: 'Dr. John Mensah'
    };
    
    console.log('Sample HMS data creation would require HMS tables to be set up first.');
    console.log('HMS module endpoints have been added to the backend.');
    
  } catch (error) {
    console.error('Error creating sample data:', error.message);
  }
}

createSampleHMSData();
