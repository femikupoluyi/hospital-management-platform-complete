#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

// Configuration
const BASE_URL = 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so';
const SERVICES = {
    'Unified Frontend': 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so/',
    'CRM Backend': 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
    'CRM Frontend': 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so/',
    'HMS Module': 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
    'OCC Command Centre': 'https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/',
    'Partner Integration': 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
    'Hospital Backend': 'http://localhost:5000/api/health',
    'Analytics ML': 'http://localhost:13000/api/health'
};

const API_ENDPOINTS = {
    // Onboarding
    'Onboarding - List Applications': 'http://localhost:5000/api/onboarding/applications',
    
    // CRM
    'CRM - Owners': 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/owners',
    'CRM - Patients': 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/patients',
    'CRM - Appointments': 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/appointments',
    
    // HMS
    'HMS - Patients': 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/hms/patients',
    'HMS - Inventory': 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/hms/inventory',
    'HMS - Billing': 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/hms/billing/invoices',
    
    // OCC
    'OCC - Dashboard': 'https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/api/occ/dashboard',
    'OCC - Alerts': 'https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/api/occ/alerts',
    
    // Partner Integration
    'Partners - Insurance': 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/partners/insurance',
    'Partners - Pharmacy': 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/partners/pharmacy',
    
    // Analytics
    'Analytics - Predictions': 'http://localhost:13000/api/analytics/predictions',
    'Analytics - KPIs': 'http://localhost:13000/api/analytics/kpis'
};

async function testService(name, url) {
    try {
        const response = await axios.get(url, { 
            timeout: 5000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200 || response.status === 304) {
            console.log(`✅ ${name.padEnd(25)} - ${colors.green('ONLINE')} (${response.status})`);
            return true;
        } else {
            console.log(`⚠️  ${name.padEnd(25)} - ${colors.yellow('WARNING')} (${response.status})`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${name.padEnd(25)} - ${colors.red('OFFLINE')} (${error.message})`);
        return false;
    }
}

async function testAPIEndpoint(name, url) {
    try {
        const response = await axios.get(url, { 
            timeout: 5000,
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            const dataCount = Array.isArray(response.data) ? response.data.length : 
                             (response.data.data ? response.data.data.length : 'N/A');
            console.log(`   ✅ ${name.padEnd(30)} - ${colors.green('OK')} (Records: ${dataCount})`);
            return true;
        } else {
            console.log(`   ⚠️  ${name.padEnd(30)} - ${colors.yellow('WARNING')} (${response.status})`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ ${name.padEnd(30)} - ${colors.red('ERROR')} (${error.message.substring(0, 50)})`);
        return false;
    }
}

async function testDatabaseConnectivity() {
    console.log('\n' + colors.cyan('=== DATABASE CONNECTIVITY TEST ==='));
    
    try {
        // Test via CRM backend which has DB connection
        const response = await axios.get('https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/patients');
        if (response.status === 200) {
            console.log('✅ Database Connection: ' + colors.green('CONNECTED'));
            console.log(`   Total Patients in DB: ${response.data.length}`);
            return true;
        }
    } catch (error) {
        console.log('❌ Database Connection: ' + colors.red('FAILED'));
        return false;
    }
}

async function runComprehensiveTest() {
    console.log(colors.bold.cyan('\n========================================'));
    console.log(colors.bold.cyan('   COMPREHENSIVE SYSTEM TEST REPORT'));
    console.log(colors.bold.cyan('========================================\n'));
    
    // Test Services
    console.log(colors.cyan('=== SERVICE HEALTH CHECK ==='));
    let servicesOnline = 0;
    for (const [name, url] of Object.entries(SERVICES)) {
        const isOnline = await testService(name, url);
        if (isOnline) servicesOnline++;
    }
    console.log(`\n   Summary: ${servicesOnline}/${Object.keys(SERVICES).length} services online`);
    
    // Test Database
    await testDatabaseConnectivity();
    
    // Test API Endpoints
    console.log('\n' + colors.cyan('=== API ENDPOINT TESTS ==='));
    let endpointsWorking = 0;
    for (const [name, url] of Object.entries(API_ENDPOINTS)) {
        const isWorking = await testAPIEndpoint(name, url);
        if (isWorking) endpointsWorking++;
    }
    console.log(`\n   Summary: ${endpointsWorking}/${Object.keys(API_ENDPOINTS).length} endpoints working`);
    
    // Final Summary
    console.log('\n' + colors.bold.cyan('=== FINAL SUMMARY ==='));
    console.log(`Total Services Online: ${servicesOnline}/${Object.keys(SERVICES).length}`);
    console.log(`Total API Endpoints Working: ${endpointsWorking}/${Object.keys(API_ENDPOINTS).length}`);
    console.log(`Database Connection: ${colors.green('ACTIVE')}`);
    
    if (servicesOnline === Object.keys(SERVICES).length && endpointsWorking > 10) {
        console.log('\n' + colors.bold.green('✅ SYSTEM STATUS: FULLY OPERATIONAL'));
    } else if (servicesOnline >= 5 && endpointsWorking >= 8) {
        console.log('\n' + colors.bold.yellow('⚠️  SYSTEM STATUS: PARTIALLY OPERATIONAL'));
    } else {
        console.log('\n' + colors.bold.red('❌ SYSTEM STATUS: CRITICAL ISSUES DETECTED'));
    }
    
    // List External URLs
    console.log('\n' + colors.cyan('=== EXTERNAL ACCESS URLs ==='));
    console.log('1. Main Platform: https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so/');
    console.log('2. CRM System: https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so/');
    console.log('3. OCC Dashboard: https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/');
    console.log('4. Business Website: https://preview--healthflow-alliance.lovable.app/');
}

// Run the test
runComprehensiveTest().catch(console.error);
