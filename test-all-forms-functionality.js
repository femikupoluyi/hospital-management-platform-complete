#!/usr/bin/env node

/**
 * Comprehensive Form and Functionality Test for Hospital Management Platform
 * Tests all forms, buttons, and features across all modules
 */

const http = require('http');
const https = require('https');

// Test configuration
const tests = {
  'HMS Core Forms': [
    {
      name: 'Patient Registration Form',
      endpoint: 'http://localhost:5801/api/patients',
      method: 'POST',
      data: {
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        phone: '+1234567890',
        email: 'test@patient.com',
        address: '123 Test St',
        bloodGroup: 'O+',
        emergencyContactName: 'Emergency Contact',
        emergencyContactPhone: '+0987654321'
      }
    },
    {
      name: 'Medical Record Creation',
      endpoint: 'http://localhost:5801/api/medical-records',
      method: 'POST',
      data: {
        patientId: 1,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Test complaint',
        diagnosis: 'Test diagnosis',
        treatment: 'Test treatment',
        prescription: 'Test prescription',
        notes: 'Test notes'
      }
    },
    {
      name: 'Invoice Generation',
      endpoint: 'http://localhost:5801/api/billing/invoice',
      method: 'POST',
      data: {
        patientId: 1,
        items: [
          { description: 'Consultation', quantity: 1, unitPrice: 100, totalPrice: 100 }
        ],
        totalAmount: 100,
        paymentMethod: 'cash',
        notes: 'Test invoice'
      }
    },
    {
      name: 'Inventory Stock Entry',
      endpoint: 'http://localhost:5801/api/inventory/stock',
      method: 'POST',
      data: {
        itemName: 'Test Medicine',
        category: 'Medication',
        quantity: 100,
        unit: 'tablets',
        reorderLevel: 20,
        supplier: 'Test Supplier',
        expiryDate: '2025-12-31'
      }
    },
    {
      name: 'Staff Schedule Creation',
      endpoint: 'http://localhost:5801/api/staff/schedule',
      method: 'POST',
      data: {
        staffId: 1,
        date: new Date().toISOString().split('T')[0],
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '16:00',
        department: 'General'
      }
    },
    {
      name: 'Bed Admission',
      endpoint: 'http://localhost:5801/api/beds/admission',
      method: 'POST',
      data: {
        patientId: 1,
        bedId: 1,
        admissionDate: new Date().toISOString(),
        admissionType: 'emergency',
        diagnosis: 'Test admission',
        doctorId: 1
      }
    },
    {
      name: 'Appointment Booking',
      endpoint: 'http://localhost:5801/api/appointments',
      method: 'POST',
      data: {
        patientId: 1,
        doctorId: 1,
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: '14:00',
        type: 'consultation',
        reason: 'Regular checkup',
        notes: 'Test appointment'
      }
    }
  ],
  'CRM Forms': [
    {
      name: 'Owner Registration',
      endpoint: 'http://localhost:7002/api/owners',
      method: 'POST',
      data: {
        name: 'Test Hospital Owner',
        email: 'owner@test.com',
        phone: '+1234567890',
        hospitalName: 'Test Hospital',
        location: 'Test City'
      }
    },
    {
      name: 'Patient Feedback',
      endpoint: 'http://localhost:7002/api/patient-feedback',
      method: 'POST',
      data: {
        patientId: 1,
        rating: 5,
        feedback: 'Excellent service',
        category: 'general'
      }
    }
  ],
  'Onboarding Forms': [
    {
      name: 'Hospital Application',
      endpoint: 'http://localhost:11001/api/applications',
      method: 'POST',
      data: {
        hospitalName: 'New Test Hospital',
        ownerName: 'John Doe',
        email: 'john@hospital.com',
        phone: '+1234567890',
        location: 'Test City',
        beds: 100,
        specialties: ['General', 'Emergency'],
        documents: []
      }
    }
  ],
  'Partner Integration Forms': [
    {
      name: 'Insurance Partner Registration',
      endpoint: 'http://localhost:8091/api/partners/insurance',
      method: 'POST',
      data: {
        companyName: 'Test Insurance Co',
        apiEndpoint: 'https://api.testinsurance.com',
        contactEmail: 'contact@insurance.com'
      }
    }
  ],
  'Analytics Queries': [
    {
      name: 'Dashboard Metrics',
      endpoint: 'http://localhost:5801/api/analytics/dashboard',
      method: 'GET'
    },
    {
      name: 'Occupancy Rates',
      endpoint: 'http://localhost:5801/api/analytics/occupancy',
      method: 'GET'
    }
  ],
  'OCC Monitoring': [
    {
      name: 'Hospital List',
      endpoint: 'http://localhost:9001/api/hospitals',
      method: 'GET'
    },
    {
      name: 'Alert System',
      endpoint: 'http://localhost:9001/api/alerts',
      method: 'GET'
    }
  ]
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Test function
async function testEndpoint(test) {
  return new Promise((resolve) => {
    const data = test.data ? JSON.stringify(test.data) : null;
    const url = new URL(test.endpoint);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) })
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({
          success: res.statusCode < 400,
          statusCode: res.statusCode,
          data: responseData,
          test: test.name
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        test: test.name
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout',
        test: test.name
      });
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Main test runner
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║       COMPREHENSIVE FORM & FUNCTIONALITY TEST                        ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.yellow}Testing all forms, buttons, and API endpoints...${colors.reset}\n`);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Run tests for each category
  for (const [category, categoryTests] of Object.entries(tests)) {
    console.log(`\n${colors.bright}${colors.cyan}━━━ ${category} ━━━${colors.reset}`);
    
    for (const test of categoryTests) {
      process.stdout.write(`Testing ${test.name}... `);
      const result = await testEndpoint(test);
      results.total++;
      
      if (result.success) {
        console.log(`${colors.green}✓ PASSED${colors.reset} (Status: ${result.statusCode})`);
        results.passed++;
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset} - ${result.error || `Status: ${result.statusCode}`}`);
        results.failed++;
        results.errors.push({
          test: test.name,
          endpoint: test.endpoint,
          error: result.error || `HTTP ${result.statusCode}`
        });
      }
    }
  }

  // Display summary
  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    results.errors.forEach(error => {
      console.log(`  • ${error.test}: ${error.error}`);
    });
  }

  // Test external URLs
  console.log(`\n${colors.bright}${colors.cyan}━━━ EXTERNAL URL VALIDATION ━━━${colors.reset}`);
  const externalUrls = [
    { name: 'HMS Portal', url: 'https://hms-portal-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'HMS API', url: 'https://hms-api-morphvm-mkofwuzh.http.cloud.morph.so' },
    { name: 'OCC Dashboard', url: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so' }
  ];

  for (const site of externalUrls) {
    process.stdout.write(`Checking ${site.name}... `);
    
    https.get(site.url, { timeout: 10000 }, (res) => {
      if (res.statusCode < 400) {
        console.log(`${colors.green}✓ ACCESSIBLE${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ Status: ${res.statusCode}${colors.reset}`);
      }
    }).on('error', (err) => {
      console.log(`${colors.red}✗ ERROR${colors.reset} - ${err.message}`);
    });
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${colors.bright}${colors.green}Testing completed at ${new Date().toISOString()}${colors.reset}`);
  
  // Return status code based on results
  return results.failed === 0 ? 0 : 1;
}

// Run the tests
runTests().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error(`${colors.red}Test runner error: ${error.message}${colors.reset}`);
  process.exit(1);
});
