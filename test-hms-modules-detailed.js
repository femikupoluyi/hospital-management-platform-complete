const axios = require('axios');
const colors = require('colors');

const API_BASE = 'http://localhost:5801';
const TOKEN = 'test-token'; // We'll get a real token after login

// Test data
const testData = {
    patient: {
        name: 'Test Patient ' + Date.now(),
        dob: '1990-01-01',
        gender: 'male',
        contact: '1234567890',
        email: 'test@example.com',
        address: 'Test Address'
    },
    staff: {
        name: 'Test Staff ' + Date.now(),
        role: 'Doctor',
        department: 'General',
        email: 'staff@test.com',
        phone: '9876543210'
    },
    appointment: {
        patient_id: null,
        doctor_id: null,
        appointment_date: new Date(Date.now() + 86400000).toISOString(),
        reason: 'General Checkup'
    },
    invoice: {
        patient_id: null,
        total_amount: 5000,
        items: [
            { description: 'Consultation', amount: 2000 },
            { description: 'Tests', amount: 3000 }
        ]
    },
    inventory: {
        name: 'Test Medicine ' + Date.now(),
        category: 'medication',
        quantity: 100,
        unit: 'tablets',
        min_stock: 20,
        price: 50
    },
    bed: {
        ward: 'General Ward',
        bed_number: 'GW-' + Math.floor(Math.random() * 1000),
        status: 'available'
    },
    medical_record: {
        patient_id: null,
        diagnosis: 'Test diagnosis',
        symptoms: 'Test symptoms',
        treatment: 'Test treatment',
        notes: 'Test notes',
        visit_date: new Date().toISOString()
    },
    prescription: {
        patient_id: null,
        doctor_id: null,
        medications: [
            { name: 'Test Medicine', dosage: '2 tablets daily', duration: '7 days' }
        ],
        notes: 'Take with food'
    },
    lab_result: {
        patient_id: null,
        test_name: 'Blood Test',
        results: { 'Hemoglobin': '14 g/dL', 'WBC Count': '7000 /μL' },
        status: 'completed'
    }
};

let authToken = '';

async function testModule(name, endpoint, method = 'GET', data = null, requiresAuth = true) {
    try {
        const config = {
            method,
            url: `${API_BASE}${endpoint}`,
            headers: requiresAuth ? { 'Authorization': `Bearer ${authToken}` } : {},
            data
        };
        
        const response = await axios(config);
        console.log(`✅ ${name}: ${method} ${endpoint}`.green);
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`❌ ${name}: ${method} ${endpoint}`.red);
        console.log(`   Error: ${error.response?.data?.error || error.message}`.gray);
        return { success: false, error: error.response?.data?.error || error.message };
    }
}

async function runTests() {
    console.log('\n🏥 HOSPITAL MANAGEMENT SYSTEM - MODULE TESTING\n'.cyan.bold);
    console.log('=' .repeat(60));
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        modules: {}
    };
    
    // Test 1: Health Check
    console.log('\n📡 Testing System Health...'.yellow);
    const health = await testModule('Health Check', '/api/health', 'GET', null, false);
    results.total++;
    if (health.success) results.passed++; else results.failed++;
    
    // Test 2: Authentication
    console.log('\n🔐 Testing Authentication Module...'.yellow);
    
    // Register
    const register = await testModule('User Registration', '/api/auth/register', 'POST', {
        username: 'testuser' + Date.now(),
        password: 'password123',
        email: 'test' + Date.now() + '@test.com'
    }, false);
    results.total++;
    if (register.success) results.passed++; else results.failed++;
    
    // Login
    const login = await testModule('User Login', '/api/auth/login', 'POST', {
        username: 'admin',
        password: 'admin123'
    }, false);
    results.total++;
    if (login.success) {
        results.passed++;
        authToken = login.data.token;
        console.log('   Token obtained successfully'.gray);
    } else {
        results.failed++;
    }
    
    // Test 3: Patient Management
    console.log('\n👤 Testing Patient Management Module...'.yellow);
    
    const createPatient = await testModule('Create Patient', '/api/patients', 'POST', testData.patient);
    results.total++;
    if (createPatient.success) {
        results.passed++;
        testData.patient.id = createPatient.data.id;
        testData.appointment.patient_id = createPatient.data.id;
        testData.invoice.patient_id = createPatient.data.id;
        testData.medical_record.patient_id = createPatient.data.id;
        testData.prescription.patient_id = createPatient.data.id;
        testData.lab_result.patient_id = createPatient.data.id;
    } else results.failed++;
    
    const getPatients = await testModule('Get Patients', '/api/patients');
    results.total++;
    if (getPatients.success) results.passed++; else results.failed++;
    
    // Test 4: Medical Records
    console.log('\n📋 Testing Medical Records Module...'.yellow);
    
    const createRecord = await testModule('Create Medical Record', '/api/medical-records', 'POST', testData.medical_record);
    results.total++;
    if (createRecord.success) results.passed++; else results.failed++;
    
    const getRecords = await testModule('Get Medical Records', '/api/medical-records');
    results.total++;
    if (getRecords.success) results.passed++; else results.failed++;
    
    // Test 5: Billing & Revenue
    console.log('\n💰 Testing Billing Module...'.yellow);
    
    const createInvoice = await testModule('Create Invoice', '/api/billing/invoices', 'POST', testData.invoice);
    results.total++;
    if (createInvoice.success) results.passed++; else results.failed++;
    
    const getInvoices = await testModule('Get Invoices', '/api/billing/invoices');
    results.total++;
    if (getInvoices.success) results.passed++; else results.failed++;
    
    const getRevenue = await testModule('Get Revenue Stats', '/api/billing/revenue/stats');
    results.total++;
    if (getRevenue.success) results.passed++; else results.failed++;
    
    // Test 6: Inventory Management
    console.log('\n📦 Testing Inventory Module...'.yellow);
    
    const addInventory = await testModule('Add Inventory Item', '/api/inventory', 'POST', testData.inventory);
    results.total++;
    if (addInventory.success) results.passed++; else results.failed++;
    
    const getInventory = await testModule('Get Inventory', '/api/inventory');
    results.total++;
    if (getInventory.success) results.passed++; else results.failed++;
    
    const getLowStock = await testModule('Get Low Stock Items', '/api/inventory/low-stock');
    results.total++;
    if (getLowStock.success) results.passed++; else results.failed++;
    
    // Test 7: Staff Management
    console.log('\n👥 Testing Staff Management Module...'.yellow);
    
    const addStaff = await testModule('Add Staff', '/api/staff', 'POST', testData.staff);
    results.total++;
    if (addStaff.success) {
        results.passed++;
        testData.staff.id = addStaff.data.id;
        testData.appointment.doctor_id = addStaff.data.id;
        testData.prescription.doctor_id = addStaff.data.id;
    } else results.failed++;
    
    const getStaff = await testModule('Get Staff', '/api/staff');
    results.total++;
    if (getStaff.success) results.passed++; else results.failed++;
    
    const getSchedules = await testModule('Get Schedules', '/api/staff/schedules');
    results.total++;
    if (getSchedules.success) results.passed++; else results.failed++;
    
    // Test 8: Bed Management
    console.log('\n🛏️ Testing Bed Management Module...'.yellow);
    
    const addBed = await testModule('Add Bed', '/api/beds', 'POST', testData.bed);
    results.total++;
    if (addBed.success) results.passed++; else results.failed++;
    
    const getBeds = await testModule('Get Beds', '/api/beds');
    results.total++;
    if (getBeds.success) results.passed++; else results.failed++;
    
    const getAvailableBeds = await testModule('Get Available Beds', '/api/beds/available');
    results.total++;
    if (getAvailableBeds.success) results.passed++; else results.failed++;
    
    // Test 9: Analytics
    console.log('\n📊 Testing Analytics Module...'.yellow);
    
    const getDashboard = await testModule('Get Dashboard Stats', '/api/analytics/dashboard');
    results.total++;
    if (getDashboard.success) results.passed++; else results.failed++;
    
    const getOccupancy = await testModule('Get Occupancy Trends', '/api/analytics/occupancy');
    results.total++;
    if (getOccupancy.success) results.passed++; else results.failed++;
    
    // Test 10: Appointments
    console.log('\n📅 Testing Appointments Module...'.yellow);
    
    const createAppointment = await testModule('Create Appointment', '/api/appointments', 'POST', testData.appointment);
    results.total++;
    if (createAppointment.success) results.passed++; else results.failed++;
    
    const getAppointments = await testModule('Get Appointments', '/api/appointments');
    results.total++;
    if (getAppointments.success) results.passed++; else results.failed++;
    
    // Test 11: Prescriptions
    console.log('\n💊 Testing Prescriptions Module...'.yellow);
    
    const createPrescription = await testModule('Create Prescription', '/api/prescriptions', 'POST', testData.prescription);
    results.total++;
    if (createPrescription.success) results.passed++; else results.failed++;
    
    const getPrescriptions = await testModule('Get Prescriptions', '/api/prescriptions');
    results.total++;
    if (getPrescriptions.success) results.passed++; else results.failed++;
    
    // Test 12: Lab Results
    console.log('\n🧪 Testing Lab Results Module...'.yellow);
    
    const createLabResult = await testModule('Create Lab Result', '/api/lab-results', 'POST', testData.lab_result);
    results.total++;
    if (createLabResult.success) results.passed++; else results.failed++;
    
    const getLabResults = await testModule('Get Lab Results', '/api/lab-results');
    results.total++;
    if (getLabResults.success) results.passed++; else results.failed++;
    
    // Print Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY'.cyan.bold);
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`.green);
    console.log(`❌ Failed: ${results.failed}`.red);
    console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);
    
    if (results.failed > 0) {
        console.log('\n⚠️  Some tests failed. Please check the errors above.'.yellow);
    } else {
        console.log('\n🎉 All tests passed successfully!'.green.bold);
    }
}

// Run tests
runTests().catch(console.error);
