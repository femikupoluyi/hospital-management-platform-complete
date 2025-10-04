#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:5600/api';
let authToken = null;

async function testAPI(endpoint, method = 'GET', data = null, description = '') {
    try {
        const config = {
            method,
            url: `${API_URL}${endpoint}`,
            headers: {}
        };
        
        if (authToken) {
            config.headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        console.log(`✅ ${description || endpoint}: Success`);
        return response.data;
    } catch (error) {
        console.log(`❌ ${description || endpoint}: ${error.response?.data?.error || error.message}`);
        return null;
    }
}

async function runTests() {
    console.log('===========================================');
    console.log('   Hospital Management System Test Suite');
    console.log('===========================================\n');
    
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const health = await testAPI('/health', 'GET', null, 'Health Check');
    console.log(`   Modules active: ${Object.keys(health?.modules || {}).length}\n`);
    
    // Test 2: Authentication
    console.log('2. Testing Authentication...');
    const loginResult = await testAPI('/auth/login', 'POST', {
        email: 'admin@hospital.com',
        password: 'admin123'
    }, 'Login');
    
    if (loginResult?.token) {
        authToken = loginResult.token;
        console.log('   Token received: Yes\n');
    } else {
        console.log('   Token received: No\n');
    }
    
    // Test 3: Patient Management
    console.log('3. Testing Patient Management...');
    
    // Create a patient
    const newPatient = await testAPI('/patients', 'POST', {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        address: '123 Main St',
        bloodGroup: 'O+',
        allergies: 'None',
        medicalHistory: 'No significant history'
    }, 'Create Patient');
    
    // Get all patients
    const patients = await testAPI('/patients', 'GET', null, 'Get Patients');
    console.log(`   Total patients: ${patients?.patients?.length || 0}\n`);
    
    // Test 4: Medical Records
    console.log('4. Testing Medical Records...');
    
    if (patients?.patients?.length > 0) {
        const patientId = patients.patients[0].id;
        
        // Create medical record
        const newRecord = await testAPI('/medical-records', 'POST', {
            patientId,
            symptoms: 'Headache, fever',
            diagnosis: 'Common cold',
            treatment: 'Rest and medication',
            visitType: 'consultation'
        }, 'Create Medical Record');
        
        // Get medical records
        const records = await testAPI('/medical-records', 'GET', null, 'Get Medical Records');
        console.log(`   Total records: ${records?.records?.length || 0}\n`);
    }
    
    // Test 5: Billing
    console.log('5. Testing Billing System...');
    
    if (patients?.patients?.length > 0) {
        const patientId = patients.patients[0].id;
        
        // Create invoice
        const newInvoice = await testAPI('/billing/invoices', 'POST', {
            patientId,
            items: [
                { service: 'Consultation', quantity: 1, unitPrice: 100, total: 100 },
                { service: 'Blood Test', quantity: 1, unitPrice: 50, total: 50 }
            ],
            totalAmount: 150,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, 'Create Invoice');
        
        // Get invoices
        const invoices = await testAPI('/billing/invoices', 'GET', null, 'Get Invoices');
        console.log(`   Total invoices: ${invoices?.invoices?.length || 0}\n`);
        
        // Process payment
        if (invoices?.invoices?.length > 0) {
            const invoiceId = invoices.invoices[0].id;
            await testAPI('/billing/process-payment', 'POST', {
                invoiceId,
                amount: 150,
                paymentMethod: 'cash'
            }, 'Process Payment');
        }
    }
    
    // Test 6: Inventory Management
    console.log('6. Testing Inventory Management...');
    
    // Add stock
    const newStock = await testAPI('/inventory/add-stock', 'POST', {
        name: 'Paracetamol',
        category: 'medication',
        quantity: 100,
        unit: 'tablets',
        reorderLevel: 20,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }, 'Add Stock');
    
    // Get inventory
    const inventory = await testAPI('/inventory', 'GET', null, 'Get Inventory');
    console.log(`   Total items: ${inventory?.inventory?.length || 0}`);
    
    // Check low stock
    const lowStock = await testAPI('/inventory/low-stock', 'GET', null, 'Check Low Stock');
    console.log(`   Low stock items: ${lowStock?.items?.length || 0}\n`);
    
    // Test 7: Staff Management
    console.log('7. Testing Staff Management...');
    
    // Get staff
    const staff = await testAPI('/staff', 'GET', null, 'Get Staff');
    console.log(`   Total staff: ${staff?.staff?.length || 0}`);
    
    // Add schedule if staff exists
    if (staff?.staff?.length > 0) {
        const staffId = staff.staff[0].id;
        await testAPI('/staff/schedule', 'POST', {
            staffId,
            date: new Date().toISOString().split('T')[0],
            shift: 'morning',
            startTime: '08:00',
            endTime: '16:00'
        }, 'Add Schedule');
        
        // Get roster
        const roster = await testAPI('/staff/roster', 'GET', null, 'Get Roster');
        console.log(`   Roster entries: ${roster?.roster?.length || 0}\n`);
    }
    
    // Test 8: Bed Management
    console.log('8. Testing Bed Management...');
    
    // Get available beds
    const beds = await testAPI('/beds/available', 'GET', null, 'Get Available Beds');
    console.log(`   Departments with beds: ${beds?.beds?.length || 0}\n`);
    
    // Test 9: Analytics
    console.log('9. Testing Analytics...');
    
    // Get dashboard data
    const analytics = await testAPI('/analytics/dashboard', 'GET', null, 'Get Analytics');
    if (analytics?.analytics?.summary) {
        console.log(`   Total Patients: ${analytics.analytics.summary.totalPatients}`);
        console.log(`   Active Admissions: ${analytics.analytics.summary.activeAdmissions}`);
        console.log(`   Total Revenue: $${analytics.analytics.summary.totalRevenue}`);
    }
    
    // Export report
    const report = await testAPI('/analytics/export-report', 'POST', {
        reportType: 'patients',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        format: 'json'
    }, 'Export Report');
    console.log(`   Report generated: ${report?.success ? 'Yes' : 'No'}\n`);
    
    console.log('===========================================');
    console.log('           Test Suite Complete');
    console.log('===========================================');
}

// Run tests
runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
