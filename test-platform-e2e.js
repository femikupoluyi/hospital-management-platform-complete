#!/usr/bin/env node

const axios = require('axios');
const pool = require('./db-config');

const BASE_URL = 'http://localhost';
const EXTERNAL_URLS = {
  unified: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
  crm: 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
  hms: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so',
  occ: 'https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so',
  partner: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so',
  sourcing: 'https://digital-sourcing-morphvm-mkofwuzh.http.cloud.morph.so'
};

async function testExternalURLs() {
  console.log('\n=== Testing External URLs ===');
  const results = [];
  
  for (const [name, url] of Object.entries(EXTERNAL_URLS)) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      results.push({
        module: name,
        url: url,
        status: response.status,
        working: response.status === 200
      });
      console.log(`✅ ${name}: ${url} - Status: ${response.status}`);
    } catch (error) {
      results.push({
        module: name,
        url: url,
        status: error.response?.status || 'ERROR',
        working: false,
        error: error.message
      });
      console.log(`❌ ${name}: ${url} - Error: ${error.message}`);
    }
  }
  
  return results;
}

async function testBackendAPIs() {
  console.log('\n=== Testing Backend APIs ===');
  const apis = [
    { name: 'Hospital Backend', url: `${BASE_URL}:5000/api/health` },
    { name: 'CRM Backend', url: `${BASE_URL}:7000/api/health` },
    { name: 'HMS Module', url: `${BASE_URL}:9000/api/health` },
    { name: 'Partner Integration', url: `${BASE_URL}:11000/api/health` },
    { name: 'Analytics', url: `${BASE_URL}:14000/api/health` },
    { name: 'ML Service', url: `${BASE_URL}:13000/api/health` },
    { name: 'OCC Command', url: `${BASE_URL}:15000/api/health` }
  ];
  
  const results = [];
  for (const api of apis) {
    try {
      const response = await axios.get(api.url, { timeout: 5000 });
      results.push({
        ...api,
        status: response.status,
        working: true,
        data: response.data
      });
      console.log(`✅ ${api.name}: ${api.url} - Working`);
    } catch (error) {
      results.push({
        ...api,
        status: error.response?.status || 'ERROR',
        working: false,
        error: error.message
      });
      console.log(`❌ ${api.name}: ${api.url} - Error: ${error.message}`);
    }
  }
  
  return results;
}

async function testDataFlow() {
  console.log('\n=== Testing Data Flow End-to-End ===');
  const tests = [];
  
  // Test 1: Create patient in CRM
  try {
    const patientData = {
      name: 'Test Patient ' + Date.now(),
      email: `test${Date.now()}@example.com`,
      phone: '+233555000' + Math.floor(Math.random() * 1000),
      dateOfBirth: '1990-01-01',
      address: 'Test Address, Accra'
    };
    
    const response = await axios.post(`${BASE_URL}:7000/api/patients`, patientData);
    tests.push({
      test: 'Create Patient',
      module: 'CRM',
      success: response.data.success,
      patientId: response.data.patientId
    });
    console.log(`✅ Created patient with ID: ${response.data.patientId}`);
  } catch (error) {
    tests.push({
      test: 'Create Patient',
      module: 'CRM',
      success: false,
      error: error.message
    });
    console.log(`❌ Failed to create patient: ${error.message}`);
  }
  
  // Test 2: Submit hospital application
  try {
    const applicationData = {
      hospital_name: 'Test Hospital ' + Date.now(),
      registration_number: 'REG' + Date.now(),
      location: 'Accra, Ghana',
      bed_count: 100,
      specializations: 'General Medicine, Surgery',
      owner_name: 'Test Owner',
      owner_email: `owner${Date.now()}@example.com`,
      owner_phone: '+233555001234',
      years_experience: 10
    };
    
    const response = await axios.post(`${BASE_URL}:8090/api/applications/submit`, applicationData);
    tests.push({
      test: 'Submit Hospital Application',
      module: 'Digital Sourcing',
      success: response.data.success,
      applicationId: response.data.applicationId,
      score: response.data.score
    });
    console.log(`✅ Submitted application with ID: ${response.data.applicationId}, Score: ${response.data.score}`);
  } catch (error) {
    tests.push({
      test: 'Submit Hospital Application',
      module: 'Digital Sourcing',
      success: false,
      error: error.message
    });
    console.log(`❌ Failed to submit application: ${error.message}`);
  }
  
  // Test 3: Test partner integration
  try {
    const claimData = {
      patientId: 'TEST123',
      providerId: 'HOSP001',
      claimAmount: 5000,
      serviceDate: new Date().toISOString(),
      diagnosis: 'General Checkup',
      insuranceProvider: 'NHIS'
    };
    
    const response = await axios.post(`${BASE_URL}:11000/api/insurance/submit-claim`, claimData);
    tests.push({
      test: 'Submit Insurance Claim',
      module: 'Partner Integration',
      success: true,
      claimId: response.data.claimId
    });
    console.log(`✅ Submitted insurance claim with ID: ${response.data.claimId}`);
  } catch (error) {
    tests.push({
      test: 'Submit Insurance Claim',
      module: 'Partner Integration',
      success: false,
      error: error.message
    });
    console.log(`❌ Failed to submit insurance claim: ${error.message}`);
  }
  
  // Test 4: Test analytics endpoint
  try {
    const response = await axios.get(`${BASE_URL}:14000/api/analytics/summary`);
    tests.push({
      test: 'Get Analytics Summary',
      module: 'Data Analytics',
      success: true,
      dataPoints: Object.keys(response.data).length
    });
    console.log(`✅ Retrieved analytics with ${Object.keys(response.data).length} data points`);
  } catch (error) {
    tests.push({
      test: 'Get Analytics Summary',
      module: 'Data Analytics',
      success: false,
      error: error.message
    });
    console.log(`❌ Failed to get analytics: ${error.message}`);
  }
  
  // Test 5: Test ML predictions
  try {
    const triageData = {
      symptoms: 'chest pain, shortness of breath',
      age: 65,
      vitalSigns: {
        bloodPressure: '160/95',
        heartRate: 110,
        temperature: 37.5
      }
    };
    
    const response = await axios.post(`${BASE_URL}:13000/api/ml/triage`, triageData);
    tests.push({
      test: 'ML Triage Assessment',
      module: 'ML Service',
      success: true,
      urgencyLevel: response.data.urgencyLevel
    });
    console.log(`✅ ML Triage assessment: Urgency level ${response.data.urgencyLevel}`);
  } catch (error) {
    tests.push({
      test: 'ML Triage Assessment',
      module: 'ML Service',
      success: false,
      error: error.message
    });
    console.log(`❌ Failed ML triage: ${error.message}`);
  }
  
  return tests;
}

async function testDatabaseConnectivity() {
  console.log('\n=== Testing Database Connectivity ===');
  try {
    // Test basic connectivity
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected: ${result.rows[0].now}`);
    
    // Count records in key tables
    const tables = [
      'crm.patients',
      'onboarding.applications',
      'organization.hospitals',
      'emr.encounters',
      'billing.invoices',
      'analytics.operational_metrics'
    ];
    
    const counts = {};
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        counts[table] = countResult.rows[0].count;
        console.log(`  ${table}: ${counts[table]} records`);
      } catch (error) {
        counts[table] = 'ERROR';
        console.log(`  ${table}: Error accessing`);
      }
    }
    
    return { connected: true, counts };
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    return { connected: false, error: error.message };
  }
}

async function generateReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE E2E TEST REPORT');
  console.log('='.repeat(60));
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0
    },
    ...results
  };
  
  // Calculate summary
  for (const [key, value] of Object.entries(results)) {
    if (Array.isArray(value)) {
      report.summary.totalTests += value.length;
      report.summary.passed += value.filter(v => v.working || v.success).length;
      report.summary.failed += value.filter(v => !v.working && !v.success).length;
    }
  }
  
  console.log(`\nTotal Tests: ${report.summary.totalTests}`);
  console.log(`✅ Passed: ${report.summary.passed}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`Success Rate: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`);
  
  // Write report to file
  const fs = require('fs');
  fs.writeFileSync('/root/e2e-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Full report saved to: /root/e2e-test-report.json');
  
  return report;
}

async function main() {
  console.log('Starting Comprehensive E2E Testing...');
  console.log('Time:', new Date().toISOString());
  
  const results = {
    externalURLs: await testExternalURLs(),
    backendAPIs: await testBackendAPIs(),
    dataFlow: await testDataFlow(),
    database: await testDatabaseConnectivity()
  };
  
  const report = await generateReport(results);
  
  // Update TODO list with results
  const todoUpdate = `
## E2E Test Results (${new Date().toISOString()})
- External URLs: ${results.externalURLs.filter(u => u.working).length}/${results.externalURLs.length} working
- Backend APIs: ${results.backendAPIs.filter(a => a.working).length}/${results.backendAPIs.length} working
- Data Flow Tests: ${results.dataFlow.filter(t => t.success).length}/${results.dataFlow.length} passed
- Database: ${results.database.connected ? 'Connected' : 'Failed'}
`;
  
  const fs = require('fs');
  const todoContent = fs.readFileSync('/root/TODO_LIST.md', 'utf8');
  fs.writeFileSync('/root/TODO_LIST.md', todoContent + '\n' + todoUpdate);
  
  console.log('\n✅ E2E Testing Complete!');
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
