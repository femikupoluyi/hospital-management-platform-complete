#!/usr/bin/env node

/**
 * End-to-End Testing of All Modules
 * Testing all forms and functionalities
 */

const http = require('http');
const https = require('https');

// Test configuration
const TESTS = {
  // Module 1: Digital Sourcing & Partner Onboarding
  onboarding: {
    name: 'Digital Sourcing & Partner Onboarding',
    tests: [
      {
        name: 'Submit Hospital Application',
        endpoint: 'http://localhost:6000/api/applications',
        method: 'POST',
        body: {
          hospitalName: 'Test Hospital ' + Date.now(),
          ownerName: 'Dr. John Smith',
          location: 'Lagos, Nigeria',
          beds: 100,
          services: ['Emergency', 'Surgery', 'Maternity', 'Pediatrics'],
          email: 'test@hospital.com',
          phone: '+234 123 456 7890',
          documents: []
        }
      },
      {
        name: 'Generate Contract',
        endpoint: 'http://localhost:6000/api/contracts/generate',
        method: 'POST',
        body: {
          applicationId: 'APP123',
          hospitalName: 'Test Hospital',
          ownerName: 'Dr. Smith',
          terms: 'Standard 70/30 revenue share'
        }
      },
      {
        name: 'View Dashboard',
        endpoint: 'http://localhost:6000/api/dashboard',
        method: 'GET'
      }
    ]
  },

  // Module 2: CRM & Relationship Management
  crm: {
    name: 'CRM & Relationship Management',
    tests: [
      {
        name: 'Create Patient',
        endpoint: 'http://localhost:7002/api/patients',
        method: 'POST',
        body: {
          name: 'Jane Doe ' + Date.now(),
          age: 35,
          gender: 'Female',
          phone: '0551234567',
          email: 'jane@test.com',
          address: '123 Test Street'
        }
      },
      {
        name: 'Schedule Appointment',
        endpoint: 'http://localhost:7002/api/appointments',
        method: 'POST',
        body: {
          patientId: 'PAT001',
          doctorId: 'DOC001',
          date: new Date(Date.now() + 86400000).toISOString(),
          time: '10:00',
          type: 'Consultation',
          notes: 'Regular checkup'
        }
      },
      {
        name: 'Create Campaign',
        endpoint: 'http://localhost:7002/api/campaigns',
        method: 'POST',
        body: {
          name: 'Health Awareness Campaign',
          type: 'health_promotion',
          channels: ['sms', 'email', 'whatsapp'],
          message: 'Stay healthy with regular checkups!'
        }
      },
      {
        name: 'Check Loyalty Points',
        endpoint: 'http://localhost:7002/api/loyalty/points/PAT001',
        method: 'GET'
      }
    ]
  },

  // Module 3: Hospital Management SaaS
  hms: {
    name: 'Hospital Management SaaS',
    tests: [
      {
        name: 'Create Medical Record',
        endpoint: 'http://localhost:5801/api/medical-records',
        method: 'POST',
        body: {
          patient_id: 'PAT001',
          doctor_id: 'DOC001',
          chief_complaint: 'Headache and fever',
          diagnosis: 'Viral infection',
          prescription: 'Paracetamol 500mg, 3 times daily',
          lab_results: 'Blood test normal',
          vital_signs: {
            blood_pressure: '120/80',
            temperature: '38.5',
            pulse: '85'
          },
          notes: 'Patient advised to rest'
        }
      },
      {
        name: 'Create Invoice',
        endpoint: 'http://localhost:5801/api/billing/create-invoice',
        method: 'POST',
        body: {
          patient_id: 'PAT001',
          payment_method: 'cash',
          items: [
            { description: 'Consultation', quantity: 1, price: 100 },
            { description: 'Lab Test', quantity: 1, price: 50 },
            { description: 'Medication', quantity: 5, price: 10 }
          ]
        }
      },
      {
        name: 'Update Inventory',
        endpoint: 'http://localhost:5801/api/inventory/stock-entry',
        method: 'POST',
        body: {
          item_code: 'MED100',
          item_name: 'Antibiotics',
          category: 'Medicine',
          quantity: 200,
          unit: 'Tablets',
          reorder_level: 50,
          unit_price: 5.00,
          supplier: 'MediSupply Co'
        }
      },
      {
        name: 'Add Staff Schedule',
        endpoint: 'http://localhost:5801/api/staff/add-schedule',
        method: 'POST',
        body: {
          staff_id: 'DOC001',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          shift: 'Morning',
          start_time: '08:00',
          end_time: '16:00',
          department: 'Emergency'
        }
      },
      {
        name: 'Admit Patient',
        endpoint: 'http://localhost:5801/api/beds/admit',
        method: 'POST',
        body: {
          bed_id: 1,
          patient_id: 'PAT001',
          doctor_id: 'DOC001',
          diagnosis: 'Observation',
          expected_discharge: new Date(Date.now() + 172800000).toISOString().split('T')[0]
        }
      },
      {
        name: 'Get Analytics Dashboard',
        endpoint: 'http://localhost:5801/api/analytics/dashboard',
        method: 'GET'
      }
    ]
  },

  // Module 4: Operations Command Centre
  occ: {
    name: 'Operations Command Centre',
    tests: [
      {
        name: 'Get Monitoring Status',
        endpoint: 'http://localhost:8080/api/monitoring/status',
        method: 'GET'
      },
      {
        name: 'Get Dashboard Metrics',
        endpoint: 'http://localhost:8080/api/dashboards/metrics',
        method: 'GET'
      },
      {
        name: 'Create Alert',
        endpoint: 'http://localhost:8080/api/alerts',
        method: 'POST',
        body: {
          type: 'low_stock',
          severity: 'warning',
          message: 'Paracetamol stock running low',
          hospitalId: 'HOSP001'
        }
      },
      {
        name: 'Create Project',
        endpoint: 'http://localhost:8080/api/projects',
        method: 'POST',
        body: {
          name: 'New Wing Construction',
          type: 'expansion',
          budget: 500000,
          timeline: '6 months',
          status: 'planning'
        }
      }
    ]
  },

  // Module 5: Partner & Ecosystem Integrations
  partner: {
    name: 'Partner & Ecosystem Integrations',
    tests: [
      {
        name: 'Submit Insurance Claim',
        endpoint: 'http://localhost:9000/api/insurance/claims',
        method: 'POST',
        body: {
          patientId: 'PAT001',
          providerId: 'NHIS',
          claimAmount: 5000,
          services: ['Consultation', 'Lab Test'],
          claimDate: new Date().toISOString()
        }
      },
      {
        name: 'Create Pharmacy Order',
        endpoint: 'http://localhost:9000/api/pharmacy/orders',
        method: 'POST',
        body: {
          items: [
            { code: 'MED001', name: 'Paracetamol', quantity: 500 },
            { code: 'MED002', name: 'Amoxicillin', quantity: 200 }
          ],
          supplier: 'PharmaCo',
          urgency: 'normal'
        }
      },
      {
        name: 'Schedule Telemedicine',
        endpoint: 'http://localhost:9000/api/telemedicine/sessions',
        method: 'POST',
        body: {
          patientId: 'PAT001',
          doctorId: 'DOC001',
          scheduledTime: new Date(Date.now() + 86400000).toISOString(),
          type: 'consultation'
        }
      },
      {
        name: 'Generate Compliance Report',
        endpoint: 'http://localhost:9000/api/compliance/reports',
        method: 'POST',
        body: {
          reportType: 'monthly',
          period: new Date().toISOString().substring(0, 7),
          includeMetrics: ['patient_count', 'revenue', 'occupancy']
        }
      }
    ]
  },

  // Module 6: Data & Analytics
  analytics: {
    name: 'Data & Analytics',
    tests: [
      {
        name: 'Get Data Lake Status',
        endpoint: 'http://localhost:9500/api/data-lake/status',
        method: 'GET'
      },
      {
        name: 'Get Predictions',
        endpoint: 'http://localhost:9500/api/analytics/predictions',
        method: 'POST',
        body: {
          type: 'patient_demand',
          period: 7,
          department: 'Emergency'
        }
      },
      {
        name: 'Run Triage Bot',
        endpoint: 'http://localhost:9501/api/ml/triage',
        method: 'POST',
        body: {
          symptoms: ['fever', 'headache', 'fatigue'],
          duration: 3,
          severity: 'moderate'
        }
      },
      {
        name: 'Fraud Detection',
        endpoint: 'http://localhost:9501/api/ml/fraud-detection',
        method: 'POST',
        body: {
          transactionId: 'TXN001',
          amount: 50000,
          patientId: 'PAT001',
          patterns: []
        }
      }
    ]
  }
};

// Test Results
const results = {
  timestamp: new Date().toISOString(),
  modules: {},
  totalTests: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 5000
    };
    
    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        status: 0,
        data: null,
        success: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        data: null,
        success: false,
        error: 'Request timeout'
      });
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Run tests for a module
async function testModule(moduleName, moduleConfig) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${moduleConfig.name}`);
  console.log('='.repeat(60));
  
  const moduleResults = {
    name: moduleConfig.name,
    tests: [],
    passed: 0,
    failed: 0
  };
  
  for (const test of moduleConfig.tests) {
    process.stdout.write(`  ${test.name}... `);
    
    try {
      const response = await makeRequest(test.endpoint, {
        method: test.method,
        body: test.body
      });
      
      const testResult = {
        name: test.name,
        endpoint: test.endpoint,
        method: test.method,
        status: response.status,
        success: response.success
      };
      
      if (response.success) {
        console.log(`✓ PASSED (${response.status})`);
        moduleResults.passed++;
      } else if (response.error) {
        console.log(`✗ FAILED (${response.error})`);
        testResult.error = response.error;
        moduleResults.failed++;
      } else {
        console.log(`✗ FAILED (HTTP ${response.status})`);
        moduleResults.failed++;
      }
      
      moduleResults.tests.push(testResult);
      
    } catch (error) {
      console.log(`✗ ERROR: ${error.message}`);
      moduleResults.tests.push({
        name: test.name,
        endpoint: test.endpoint,
        success: false,
        error: error.message
      });
      moduleResults.failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  results.modules[moduleName] = moduleResults;
  results.totalTests += moduleConfig.tests.length;
  results.passed += moduleResults.passed;
  results.failed += moduleResults.failed;
  
  console.log(`\n  Module Summary: ${moduleResults.passed}/${moduleConfig.tests.length} tests passed`);
}

// Test exposed URLs
async function testExposedUrls() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing Exposed URLs');
  console.log('='.repeat(60));
  
  const exposedUrls = [
    { name: 'HMS Portal', url: 'https://hms-portal-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'OCC Dashboard', url: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'Analytics Dashboard', url: 'https://analytics-dashboard-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'Onboarding Portal', url: 'https://onboarding-portal-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'CRM Portal', url: 'https://crm-portal-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'Partner API', url: 'https://partner-api-morphvm-mkofwuzh.http.cloud.morph.so' }
  ];
  
  results.exposedUrls = [];
  
  for (const {name, url} of exposedUrls) {
    process.stdout.write(`  ${name}: ${url}... `);
    
    try {
      const response = await makeRequest(url);
      
      if (response.success) {
        console.log('✓ ACCESSIBLE');
        results.exposedUrls.push({ name, url, accessible: true });
      } else {
        console.log(`✗ NOT ACCESSIBLE (${response.status || response.error})`);
        results.exposedUrls.push({ name, url, accessible: false, error: response.error });
      }
    } catch (error) {
      console.log(`✗ ERROR: ${error.message}`);
      results.exposedUrls.push({ name, url, accessible: false, error: error.message });
    }
  }
}

// Generate summary report
function generateReport() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('E2E TEST SUMMARY REPORT');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.totalTests) * 100).toFixed(2)}%`);
  
  console.log('\n--- MODULE RESULTS ---');
  for (const [name, module] of Object.entries(results.modules)) {
    console.log(`${module.name}: ${module.passed}/${module.tests.length} passed`);
  }
  
  if (results.exposedUrls) {
    console.log('\n--- EXPOSED URL STATUS ---');
    const accessibleCount = results.exposedUrls.filter(u => u.accessible).length;
    console.log(`Accessible: ${accessibleCount}/${results.exposedUrls.length}`);
    for (const url of results.exposedUrls) {
      console.log(`  ${url.accessible ? '✓' : '✗'} ${url.name}`);
    }
  }
  
  if (results.failed > 0) {
    console.log('\n--- FAILED TESTS ---');
    for (const [moduleName, module] of Object.entries(results.modules)) {
      const failedTests = module.tests.filter(t => !t.success);
      if (failedTests.length > 0) {
        console.log(`\n${module.name}:`);
        for (const test of failedTests) {
          console.log(`  ✗ ${test.name}: ${test.error || `HTTP ${test.status}`}`);
        }
      }
    }
  }
  
  // Save report to file
  const fs = require('fs');
  fs.writeFileSync('/root/E2E_TEST_REPORT.json', JSON.stringify(results, null, 2));
  console.log('\n✓ Report saved to /root/E2E_TEST_REPORT.json');
}

// Main execution
async function main() {
  console.log('🚀 STARTING END-TO-END TESTING OF ALL MODULES');
  console.log('Testing all forms, APIs, and functionalities...\n');
  
  // Test each module
  for (const [moduleName, moduleConfig] of Object.entries(TESTS)) {
    await testModule(moduleName, moduleConfig);
    // Small delay between modules
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Test exposed URLs
  await testExposedUrls();
  
  // Generate report
  generateReport();
  
  console.log('\n✅ E2E Testing Complete!');
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
