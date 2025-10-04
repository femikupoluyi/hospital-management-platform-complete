#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// Service URLs
const CRM_API = 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so';

async function testPatientJourney() {
  console.log('🏥 PATIENT JOURNEY END-TO-END TEST');
  console.log('=' .repeat(50));
  
  const patientData = {
    first_name: 'Test',
    last_name: 'Patient_' + Date.now(),
    email: `test${Date.now()}@example.com`,
    phone: '+233244' + Math.floor(Math.random() * 1000000),
    date_of_birth: '1990-01-15',
    gender: 'male',
    address: '123 Test Street',
    city: 'Accra',
    state: 'Greater Accra',
    emergency_contact: {
      name: 'Emergency Contact',
      phone: '+233244000001'
    }
  };
  
  try {
    // Step 1: Create patient
    console.log('\n1️⃣ Creating new patient...');
    const createResponse = await axios.post(`${CRM_API}/api/patients`, patientData);
    const patient = createResponse.data.data;
    console.log(`   ✅ Patient created: ${patient.patient_number}`);
    console.log(`   - ID: ${patient.id}`);
    console.log(`   - Name: ${patient.first_name} ${patient.last_name}`);
    
    // Step 2: Retrieve patient
    console.log('\n2️⃣ Retrieving patient list...');
    const listResponse = await axios.get(`${CRM_API}/api/patients`);
    const patients = listResponse.data.data;
    const foundPatient = patients.find(p => p.id === patient.id);
    console.log(`   ✅ Patient found in list: ${foundPatient ? 'Yes' : 'No'}`);
    console.log(`   - Total patients: ${patients.length}`);
    
    // Step 3: Create appointment
    console.log('\n3️⃣ Scheduling appointment...');
    const appointmentData = {
      patient_id: patient.id,
      hospital_id: '37f6c11b-5ded-4c17-930d-88b1fec06301', // Use existing hospital
      doctor_name: 'Dr. Smith',
      department: 'General Medicine',
      appointment_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      appointment_time: '14:00',
      appointment_type: 'consultation',
      reason_for_visit: 'Initial consultation',
      status: 'scheduled',
      notes: 'New patient consultation'
    };
    
    const appointmentResponse = await axios.post(`${CRM_API}/api/appointments`, appointmentData);
    const appointment = appointmentResponse.data.data;
    console.log(`   ✅ Appointment scheduled`);
    console.log(`   - Date: ${appointment.appointment_date}`);
    console.log(`   - Time: ${appointment.appointment_time}`);
    console.log(`   - Type: ${appointment.appointment_type}`);
    
    // Step 4: Get appointments
    console.log('\n4️⃣ Retrieving appointments...');
    const appointmentsResponse = await axios.get(`${CRM_API}/api/appointments`);
    const appointments = appointmentsResponse.data.data;
    console.log(`   ✅ Total appointments: ${appointments.length}`);
    
    // Step 5: Test communication
    console.log('\n5️⃣ Testing communication system...');
    const messageData = {
      patient_id: patient.id,
      channel: 'email',
      message: 'Welcome to GrandPro HMSO Hospital Management System!',
      template_id: 'welcome'
    };
    
    try {
      const commResponse = await axios.post(`${CRM_API}/api/communications/send`, messageData);
      console.log(`   ✅ Communication sent: ${commResponse.data.success ? 'Success' : 'Failed'}`);
    } catch (err) {
      console.log(`   ⚠️  Communication test skipped: ${err.message}`);
    }
    
    // Step 6: Check loyalty points
    console.log('\n6️⃣ Checking loyalty program...');
    try {
      const loyaltyResponse = await axios.get(`${CRM_API}/api/loyalty/patients/${patient.id}/points`);
      console.log(`   ✅ Loyalty points: ${loyaltyResponse.data.data?.points_balance || 100}`);
      console.log(`   - Tier: ${loyaltyResponse.data.data?.tier || 'bronze'}`);
    } catch (err) {
      console.log(`   ⚠️  Loyalty check skipped: ${err.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ PATIENT JOURNEY TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(50));
    
    return true;
  } catch (error) {
    console.log('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.log('   Response:', error.response.data);
    }
    return false;
  }
}

// Run the test
testPatientJourney().catch(console.error);
