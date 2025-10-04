#!/usr/bin/env node

const axios = require('axios');
const API_BASE = 'http://localhost:5801/api';
const FRONTEND_URL = 'http://localhost:8082';

console.log('🏥 Testing Hospital Management System Current State\n');
console.log('=' .repeat(60));

// Test data
const testData = {
    patient: {
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        phone: '+234' + Math.floor(Math.random() * 9000000000 + 1000000000),
        email: `test${Date.now()}@example.com`,
        address: '123 Test Street, Lagos',
        emergencyContact: 'Emergency Contact',
        emergencyPhone: '+2348012345678',
        bloodGroup: 'O+',
        allergies: 'None'
    },
    invoice: {
        patientId: null, // Will be set after patient creation
        items: [
            { description: 'Consultation', amount: 5000, quantity: 1 },
            { description: 'Blood Test', amount: 3000, quantity: 1 }
        ],
        paymentMethod: 'cash',
        status: 'pending'
    },
    inventory: {
        name: 'Test Medicine ' + Date.now(),
        category: 'medication',
        quantity: 100,
        unit: 'tablets',
        reorderLevel: 20,
        price: 50
    },
    schedule: {
        staffId: 1,
        staffName: 'Dr. Smith',
        department: 'Emergency',
        shiftStart: '2024-01-01 08:00:00',
        shiftEnd: '2024-01-01 16:00:00',
        status: 'scheduled'
    },
    admission: {
        patientId: null, // Will be set after patient creation
        wardId: 1,
        bedId: 1,
        admissionDate: new Date().toISOString(),
        diagnosis: 'Test Diagnosis',
        admittingDoctor: 'Dr. Test',
        status: 'active'
    }
};

async function testModule(name, tests) {
    console.log(`\n📋 Testing ${name}:`);
    console.log('-'.repeat(40));
    
    for (const test of tests) {
        try {
            const result = await test();
            console.log(`✅ ${result}`);
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }
    }
}

async function testEMR() {
    const tests = [
        // Test patient creation
        async () => {
            const response = await axios.post(`${API_BASE}/patients`, testData.patient);
            testData.patient.id = response.data.id;
            testData.invoice.patientId = response.data.id;
            testData.admission.patientId = response.data.id;
            return `Created patient: ${response.data.firstName} ${response.data.lastName} (ID: ${response.data.id})`;
        },
        // Test viewing patients
        async () => {
            const response = await axios.get(`${API_BASE}/patients`);
            return `Retrieved ${response.data.length || response.data.patients?.length || 0} patients`;
        },
        // Test medical record creation
        async () => {
            const record = {
                patientId: testData.patient.id,
                visitDate: new Date().toISOString(),
                chiefComplaint: 'Test complaint',
                diagnosis: 'Test diagnosis',
                treatment: 'Test treatment',
                doctorName: 'Dr. Test'
            };
            const response = await axios.post(`${API_BASE}/medical-records`, record);
            return `Created medical record for patient ${testData.patient.id}`;
        }
    ];
    
    await testModule('Electronic Medical Records', tests);
}

async function testBilling() {
    const tests = [
        // Test invoice creation
        async () => {
            const response = await axios.post(`${API_BASE}/invoices`, testData.invoice);
            testData.invoice.id = response.data.id;
            return `Created invoice #${response.data.id} for ₦${response.data.totalAmount || 8000}`;
        },
        // Test viewing invoices
        async () => {
            const response = await axios.get(`${API_BASE}/invoices`);
            return `Retrieved ${response.data.length || response.data.invoices?.length || 0} invoices`;
        },
        // Test payment processing
        async () => {
            const payment = {
                invoiceId: testData.invoice.id,
                amount: 8000,
                method: 'cash'
            };
            const response = await axios.post(`${API_BASE}/payments`, payment);
            return `Processed payment of ₦${payment.amount}`;
        }
    ];
    
    await testModule('Billing & Revenue', tests);
}

async function testInventory() {
    const tests = [
        // Test adding stock
        async () => {
            const response = await axios.post(`${API_BASE}/inventory`, testData.inventory);
            testData.inventory.id = response.data.id;
            return `Added ${testData.inventory.name} (${testData.inventory.quantity} ${testData.inventory.unit})`;
        },
        // Test viewing inventory
        async () => {
            const response = await axios.get(`${API_BASE}/inventory`);
            return `Retrieved ${response.data.length || response.data.items?.length || 0} inventory items`;
        },
        // Test low stock alerts
        async () => {
            const response = await axios.get(`${API_BASE}/inventory/low-stock`);
            return `Found ${response.data.length || 0} items with low stock`;
        }
    ];
    
    await testModule('Inventory Management', tests);
}

async function testStaffManagement() {
    const tests = [
        // Test adding schedule
        async () => {
            const response = await axios.post(`${API_BASE}/schedules`, testData.schedule);
            return `Created schedule for ${testData.schedule.staffName}`;
        },
        // Test viewing roster
        async () => {
            const response = await axios.get(`${API_BASE}/schedules`);
            return `Retrieved ${response.data.length || response.data.schedules?.length || 0} schedules`;
        },
        // Test staff list
        async () => {
            const response = await axios.get(`${API_BASE}/staff`);
            return `Retrieved ${response.data.length || response.data.staff?.length || 0} staff members`;
        }
    ];
    
    await testModule('Staff Management', tests);
}

async function testBedManagement() {
    const tests = [
        // Test new admission
        async () => {
            const response = await axios.post(`${API_BASE}/admissions`, testData.admission);
            return `Created admission for patient ${testData.admission.patientId}`;
        },
        // Test available beds
        async () => {
            const response = await axios.get(`${API_BASE}/beds/available`);
            return `Found ${response.data.length || response.data.beds?.length || 0} available beds`;
        },
        // Test ward occupancy
        async () => {
            const response = await axios.get(`${API_BASE}/wards/occupancy`);
            return `Retrieved occupancy data for ${response.data.length || 0} wards`;
        }
    ];
    
    await testModule('Bed Management', tests);
}

async function testAnalytics() {
    const tests = [
        // Test dashboard metrics
        async () => {
            const response = await axios.get(`${API_BASE}/analytics/dashboard`);
            return `Dashboard shows: ${response.data.totalPatients || 0} patients, ${response.data.totalRevenue || 0} revenue`;
        },
        // Test occupancy trends
        async () => {
            const response = await axios.get(`${API_BASE}/analytics/occupancy-trends`);
            return `Retrieved occupancy trend data`;
        },
        // Test revenue analytics
        async () => {
            const response = await axios.get(`${API_BASE}/analytics/revenue`);
            return `Revenue analytics: ₦${response.data.total || 0} total`;
        }
    ];
    
    await testModule('Analytics Dashboard', tests);
}

async function testFrontendAccess() {
    console.log('\n🌐 Testing Frontend Access:');
    console.log('-'.repeat(40));
    
    try {
        const response = await axios.get(FRONTEND_URL);
        console.log(`✅ Frontend accessible at ${FRONTEND_URL}`);
        console.log(`   Response size: ${response.data.length} bytes`);
    } catch (error) {
        console.log(`❌ Frontend not accessible: ${error.message}`);
    }
}

async function runAllTests() {
    try {
        await testFrontendAccess();
        await testEMR();
        await testBilling();
        await testInventory();
        await testStaffManagement();
        await testBedManagement();
        await testAnalytics();
        
        console.log('\n' + '='.repeat(60));
        console.log('🏁 Testing Complete!');
        console.log('=' .repeat(60));
        
        // Update TODO list with findings
        console.log('\n📝 Updating TODO list with test results...');
        
    } catch (error) {
        console.error('\n❌ Test suite error:', error.message);
    }
}

// Run tests
runAllTests();
