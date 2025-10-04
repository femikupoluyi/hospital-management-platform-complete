// Comprehensive HMS Functionality Test

const axios = require('axios');

const API_BASE = 'http://localhost:5801/api';
let authToken = '';
let testResults = {
    passed: 0,
    failed: 0,
    modules: {}
};

async function test(name, func) {
    try {
        await func();
        console.log(`✅ ${name}`);
        testResults.passed++;
        return true;
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        testResults.failed++;
        return false;
    }
}

async function runTests() {
    console.log('\n========== HMS Complete Functionality Test ==========\n');
    
    // 1. Authentication
    console.log('1. AUTHENTICATION MODULE');
    testResults.modules.auth = {};
    
    testResults.modules.auth.login = await test('Login with admin credentials', async () => {
        const response = await axios.post(`${API_BASE}/auth/login`, {
            username: 'admin',
            password: 'admin@HMS2024'
        });
        authToken = response.data.token;
        if (!authToken) throw new Error('No token received');
    });
    
    // Set auth header for subsequent requests
    const config = { headers: { 'Authorization': `Bearer ${authToken}` } };
    
    // 2. Medical Records
    console.log('\n2. MEDICAL RECORDS MODULE');
    testResults.modules.medicalRecords = {};
    
    testResults.modules.medicalRecords.create = await test('Create medical record', async () => {
        const response = await axios.post(`${API_BASE}/medical-records`, {
            patientId: 'P001',
            recordType: 'consultation',
            chiefComplaint: 'Headache and fever',
            diagnosis: 'Common cold',
            treatment: 'Rest and hydration'
        }, config);
        if (!response.data.success) throw new Error('Failed to create record');
    });
    
    testResults.modules.medicalRecords.fetch = await test('Fetch medical records', async () => {
        const response = await axios.get(`${API_BASE}/medical-records/P001`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    // 3. Billing
    console.log('\n3. BILLING MODULE');
    testResults.modules.billing = {};
    
    testResults.modules.billing.createInvoice = await test('Create invoice', async () => {
        const response = await axios.post(`${API_BASE}/billing/invoices`, {
            patientId: 'P001',
            items: [{ description: 'Consultation', amount: 5000 }],
            totalAmount: 5000,
            paymentMethod: 'cash'
        }, config);
        if (!response.data.invoice) throw new Error('No invoice created');
    });
    
    testResults.modules.billing.fetchInvoices = await test('Fetch invoices', async () => {
        const response = await axios.get(`${API_BASE}/billing/invoices`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    // 4. Inventory
    console.log('\n4. INVENTORY MODULE');
    testResults.modules.inventory = {};
    
    testResults.modules.inventory.addStock = await test('Add inventory stock', async () => {
        const response = await axios.post(`${API_BASE}/inventory/stock`, {
            itemName: 'Test Medicine',
            category: 'medication',
            quantity: 100,
            minimumStock: 20,
            unitPrice: 50
        }, config);
        if (!response.data.success) throw new Error('Failed to add stock');
    });
    
    testResults.modules.inventory.checkLowStock = await test('Check low stock', async () => {
        const response = await axios.get(`${API_BASE}/inventory/low-stock`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    testResults.modules.inventory.viewAll = await test('View all inventory', async () => {
        const response = await axios.get(`${API_BASE}/inventory`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    // 5. Staff Management
    console.log('\n5. STAFF MANAGEMENT MODULE');
    testResults.modules.staff = {};
    
    testResults.modules.staff.createSchedule = await test('Create staff schedule', async () => {
        const response = await axios.post(`${API_BASE}/staff/schedule`, {
            staffId: 1,
            shiftDate: new Date().toISOString().split('T')[0],
            shiftStart: '08:00',
            shiftEnd: '16:00',
            department: 'General'
        }, config);
        if (!response.data.success) throw new Error('Failed to create schedule');
    });
    
    testResults.modules.staff.viewRoster = await test('View staff roster', async () => {
        const today = new Date().toISOString().split('T')[0];
        const response = await axios.get(`${API_BASE}/staff/roster/${today}`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    // 6. Bed Management
    console.log('\n6. BED MANAGEMENT MODULE');
    testResults.modules.beds = {};
    
    testResults.modules.beds.checkAvailable = await test('Check available beds', async () => {
        const response = await axios.get(`${API_BASE}/beds/available`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    testResults.modules.beds.admission = await test('Create admission', async () => {
        const response = await axios.post(`${API_BASE}/beds/admission`, {
            patientId: 'P002',
            wardId: '1',
            bedNumber: 'GW-01',
            admissionReason: 'Treatment required'
        }, config);
        if (!response.data.success) throw new Error('Failed to create admission');
    });
    
    // 7. Patient Management
    console.log('\n7. PATIENT MANAGEMENT MODULE');
    testResults.modules.patients = {};
    
    testResults.modules.patients.register = await test('Register new patient', async () => {
        const response = await axios.post(`${API_BASE}/patients`, {
            firstName: 'Test',
            lastName: 'Patient',
            dateOfBirth: '1990-01-01',
            gender: 'Male',
            phone: '08012345678',
            email: 'test@example.com'
        }, config);
        if (!response.data.patient) throw new Error('Failed to register patient');
    });
    
    testResults.modules.patients.fetchAll = await test('Fetch all patients', async () => {
        const response = await axios.get(`${API_BASE}/patients`, config);
        if (!Array.isArray(response.data)) throw new Error('Invalid response');
    });
    
    // 8. Analytics Dashboard
    console.log('\n8. ANALYTICS MODULE');
    testResults.modules.analytics = {};
    
    testResults.modules.analytics.dashboard = await test('Fetch analytics dashboard', async () => {
        const response = await axios.get(`${API_BASE}/analytics/dashboard`, config);
        if (!response.data.patients || !response.data.beds) throw new Error('Invalid dashboard data');
    });
    
    // 9. WebSocket Connection
    console.log('\n9. REAL-TIME FEATURES');
    testResults.modules.realtime = {};
    
    testResults.modules.realtime.websocket = await test('WebSocket connectivity', async () => {
        const WebSocket = require('ws');
        const ws = new WebSocket('ws://localhost:5801');
        
        return new Promise((resolve, reject) => {
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'ping' }));
                ws.close();
                resolve();
            });
            ws.on('error', reject);
            setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
        });
    });
    
    // Summary
    console.log('\n========== TEST SUMMARY ==========');
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    console.log('\n========== MODULE STATUS ==========');
    for (const [module, tests] of Object.entries(testResults.modules)) {
        const passed = Object.values(tests).filter(t => t === true).length;
        const total = Object.keys(tests).length;
        const status = passed === total ? '✅' : '⚠️';
        console.log(`${status} ${module.toUpperCase()}: ${passed}/${total} tests passed`);
    }
    
    // Frontend Test
    console.log('\n========== FRONTEND ACCESSIBILITY ==========');
    try {
        const response = await axios.get('http://localhost:5801/');
        console.log('✅ Frontend is accessible');
        console.log('   URL: http://localhost:5801/');
    } catch (error) {
        console.log('❌ Frontend not accessible');
    }
    
    // External URL Test
    console.log('\n========== EXTERNAL ACCESS ==========');
    console.log('Main HMS: http://morphvm:5801/');
    console.log('API Health: http://morphvm:5801/api/health');
    
    return testResults.failed === 0;
}

// Run tests
runTests().then(success => {
    if (success) {
        console.log('\n✅ ALL TESTS PASSED! HMS is fully functional.\n');
        process.exit(0);
    } else {
        console.log('\n⚠️ Some tests failed. Please check the implementation.\n');
        process.exit(1);
    }
}).catch(error => {
    console.error('Test execution error:', error);
    process.exit(1);
});
