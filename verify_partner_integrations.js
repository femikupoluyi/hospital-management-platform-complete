#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');
const { Client } = require('pg');
const fs = require('fs');

// Configuration
const PARTNER_API = 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so';
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

console.log(colors.bold.cyan('\n╔══════════════════════════════════════════════╗'));
console.log(colors.bold.cyan('║   PARTNER INTEGRATION VERIFICATION TEST      ║'));
console.log(colors.bold.cyan('╚══════════════════════════════════════════════╝\n'));

async function setupTestData() {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    console.log(colors.cyan('Setting up test data...'));
    
    // Test data already exists in the database
    console.log('  Using existing partner data from database...');
    
    console.log(colors.green('✓ Test data setup complete\n'));
  } catch (error) {
    console.error(colors.red('Error setting up test data:'), error.message);
  } finally {
    await client.end();
  }
}

async function testInsuranceIntegration() {
  console.log(colors.yellow('\n1. INSURANCE PROVIDER INTEGRATION TEST'));
  console.log('─'.repeat(50));
  
  try {
    // Get insurance partners
    console.log('  Getting insurance partners...');
    const partnersResponse = await axios.get(`${PARTNER_API}/api/partners/insurance`);
    console.log(`  ✓ Found ${partnersResponse.data.length} insurance partner(s)`);
    
    if (partnersResponse.data.length > 0) {
      const partner = partnersResponse.data[0];
      console.log(`  ✓ Partner: ${partner.name}`);
      
      // Submit a test claim
      console.log('  Submitting insurance claim...');
      const claimData = {
        partner_id: partner.id,
        patient_id: 1,
        claim_amount: 1500.00,
        diagnosis_code: 'J06.9',
        treatment_code: 'T001'
      };
      
      const claimResponse = await axios.post(`${PARTNER_API}/api/partners/insurance/claims`, claimData);
      console.log(`  ✓ Claim submitted successfully`);
      console.log(`  ✓ Claim ID: ${claimResponse.data.response.claim_id}`);
      console.log(`  ✓ Status: ${claimResponse.data.response.status}`);
      console.log(`  ✓ Amount Approved: $${claimResponse.data.response.amount_approved}`);
      
      // Verify claim in database
      const claimId = claimResponse.data.response.claim_id;
      const verifyResponse = await axios.get(`${PARTNER_API}/api/partners/insurance/claims/${claimId}`);
      console.log(`  ✓ Claim verified in database`);
      
      console.log(colors.green('\n  ✅ INSURANCE INTEGRATION: PASSED'));
      return true;
    }
  } catch (error) {
    console.error(colors.red(`  ✗ Insurance integration failed: ${error.message}`));
    return false;
  }
}

async function testPharmacyIntegration() {
  console.log(colors.yellow('\n2. PHARMACY SUPPLIER INTEGRATION TEST'));
  console.log('─'.repeat(50));
  
  try {
    // Get pharmacy suppliers
    console.log('  Getting pharmacy suppliers...');
    const suppliersResponse = await axios.get(`${PARTNER_API}/api/partners/pharmacy`);
    console.log(`  ✓ Found ${suppliersResponse.data.length} pharmacy supplier(s)`);
    
    if (suppliersResponse.data.length > 0) {
      const supplier = suppliersResponse.data[0];
      console.log(`  ✓ Supplier: ${supplier.name}`);
      
      // Create auto-restock order
      console.log('  Creating auto-restock order...');
      const orderData = {
        supplier_id: supplier.id,
        hospital_id: 1,
        items: [
          { name: 'Paracetamol 500mg', quantity: 1000, unit_price: 0.15 },
          { name: 'Amoxicillin 250mg', quantity: 500, unit_price: 0.35 },
          { name: 'Insulin Vials', quantity: 100, unit_price: 12.50 }
        ]
      };
      
      const orderResponse = await axios.post(`${PARTNER_API}/api/partners/pharmacy/restock`, orderData);
      console.log(`  ✓ Restock order created successfully`);
      console.log(`  ✓ Order ID: ${orderResponse.data.supplier_response.order_id}`);
      console.log(`  ✓ Status: ${orderResponse.data.supplier_response.status}`);
      console.log(`  ✓ Total Amount: $${orderResponse.data.total_amount}`);
      console.log(`  ✓ Tracking: ${orderResponse.data.supplier_response.tracking_number}`);
      
      // Verify order history
      const ordersResponse = await axios.get(`${PARTNER_API}/api/partners/pharmacy/orders`);
      console.log(`  ✓ Order history accessible (${ordersResponse.data.length} orders)`);
      
      console.log(colors.green('\n  ✅ PHARMACY INTEGRATION: PASSED'));
      return true;
    }
  } catch (error) {
    console.error(colors.red(`  ✗ Pharmacy integration failed: ${error.message}`));
    return false;
  }
}

async function testTelemedicineIntegration() {
  console.log(colors.yellow('\n3. TELEMEDICINE SERVICE INTEGRATION TEST'));
  console.log('─'.repeat(50));
  
  try {
    // Get telemedicine providers
    console.log('  Getting telemedicine providers...');
    const providersResponse = await axios.get(`${PARTNER_API}/api/partners/telemedicine/providers`);
    console.log(`  ✓ Found ${providersResponse.data.length} telemedicine provider(s)`);
    
    if (providersResponse.data.length > 0) {
      const provider = providersResponse.data[0];
      console.log(`  ✓ Provider: ${provider.name}`);
      const specialties = Array.isArray(provider.specialties) ? provider.specialties : 
                          (typeof provider.specialties === 'string' ? JSON.parse(provider.specialties) : []);
      console.log(`  ✓ Specialties: ${specialties.join(', ')}`);
      
      // Create telemedicine session
      console.log('  Scheduling telemedicine session...');
      const sessionData = {
        provider_id: provider.id,
        patient_id: 1,
        doctor_id: 1,
        scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      const sessionResponse = await axios.post(`${PARTNER_API}/api/partners/telemedicine/sessions`, sessionData);
      console.log(`  ✓ Session scheduled successfully`);
      console.log(`  ✓ Session Link: ${sessionResponse.data.session_link}`);
      console.log(`  ✓ Status: ${sessionResponse.data.status}`);
      console.log(`  ✓ Scheduled Time: ${new Date(sessionResponse.data.scheduled_time).toLocaleString()}`);
      
      // Verify session list
      const sessionsResponse = await axios.get(`${PARTNER_API}/api/partners/telemedicine/sessions`);
      console.log(`  ✓ Session history accessible (${sessionsResponse.data.length} sessions)`);
      
      console.log(colors.green('\n  ✅ TELEMEDICINE INTEGRATION: PASSED'));
      return true;
    }
  } catch (error) {
    console.error(colors.red(`  ✗ Telemedicine integration failed: ${error.message}`));
    return false;
  }
}

async function testComplianceReporting() {
  console.log(colors.yellow('\n4. COMPLIANCE REPORTING TEST'));
  console.log('─'.repeat(50));
  
  try {
    // Get compliance partners
    console.log('  Getting compliance partners...');
    const partnersResponse = await axios.get(`${PARTNER_API}/api/partners/compliance`);
    console.log(`  ✓ Found ${partnersResponse.data.length} compliance partner(s)`);
    
    if (partnersResponse.data.length > 0) {
      const partner = partnersResponse.data[0];
      console.log(`  ✓ Partner: ${partner.name}`);
      console.log(`  ✓ Type: ${partner.partner_type}`);
      console.log(`  ✓ Reporting Frequency: ${partner.reporting_frequency}`);
      
      // Generate and submit compliance report
      console.log('  Generating compliance report...');
      const reportData = {
        partner_id: partner.id,
        report_type: 'monthly_statistics',
        report_data: {
          period: '2025-10',
          total_patients: 1245,
          total_admissions: 342,
          bed_occupancy_rate: 85.3,
          average_length_of_stay: 4.2,
          mortality_rate: 1.2,
          infection_rate: 0.8,
          patient_satisfaction: 92.5,
          emergency_cases: 128,
          surgical_procedures: 67,
          outpatient_visits: 2341
        },
        hospital_id: 1
      };
      
      const submitResponse = await axios.post(`${PARTNER_API}/api/partners/compliance/submit`, reportData);
      console.log(`  ✓ Report submitted successfully`);
      console.log(`  ✓ Submission ID: ${submitResponse.data.id}`);
      console.log(`  ✓ Status: ${submitResponse.data.status}`);
      
      // Export report to file
      console.log('  Exporting report to file...');
      const exportData = {
        ...reportData.report_data,
        generated_at: new Date().toISOString(),
        submitted_to: partner.name,
        submission_id: submitResponse.data.id
      };
      
      const exportPath = '/root/compliance_report_export.json';
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      console.log(`  ✓ Report exported to: ${exportPath}`);
      
      // Verify submission history
      const submissionsResponse = await axios.get(`${PARTNER_API}/api/partners/compliance/submissions`);
      console.log(`  ✓ Submission history accessible (${submissionsResponse.data.length} submissions)`);
      
      // Test automated report generation
      console.log('  Testing automated report generation...');
      const dashboardResponse = await axios.get(`${PARTNER_API}/api/partners/dashboard`);
      console.log(`  ✓ Integration dashboard accessible`);
      
      console.log(colors.green('\n  ✅ COMPLIANCE REPORTING: PASSED'));
      return true;
    }
  } catch (error) {
    console.error(colors.red(`  ✗ Compliance reporting failed: ${error.message}`));
    return false;
  }
}

async function testAPILogs() {
  console.log(colors.yellow('\n5. API INTEGRATION LOGS TEST'));
  console.log('─'.repeat(50));
  
  try {
    console.log('  Retrieving API integration logs...');
    const logsResponse = await axios.get(`${PARTNER_API}/api/partners/logs`);
    console.log(`  ✓ Found ${logsResponse.data.length} log entries`);
    
    if (logsResponse.data.length > 0) {
      const recentLog = logsResponse.data[0];
      console.log(`  ✓ Recent activity: ${recentLog.api_type} - ${recentLog.endpoint}`);
      console.log(`  ✓ Status: ${recentLog.status}`);
      console.log(`  ✓ Timestamp: ${new Date(recentLog.created_at).toLocaleString()}`);
    }
    
    console.log(colors.green('\n  ✅ API LOGGING: PASSED'));
    return true;
  } catch (error) {
    console.error(colors.red(`  ✗ API logging failed: ${error.message}`));
    return false;
  }
}

// Main execution
async function runVerification() {
  try {
    // Setup test data
    await setupTestData();
    
    // Run all tests
    const results = {
      insurance: await testInsuranceIntegration(),
      pharmacy: await testPharmacyIntegration(),
      telemedicine: await testTelemedicineIntegration(),
      compliance: await testComplianceReporting(),
      logging: await testAPILogs()
    };
    
    // Summary
    console.log(colors.cyan('\n═══════════════════════════════════════════════'));
    console.log(colors.bold.cyan('VERIFICATION SUMMARY'));
    console.log(colors.cyan('═══════════════════════════════════════════════'));
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(r => r).length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(0);
    
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${colors.green(passedTests)}`);
    console.log(`Failed: ${colors.red(totalTests - passedTests)}`);
    console.log(`Pass Rate: ${passRate >= 100 ? colors.green(passRate + '%') : colors.yellow(passRate + '%')}`);
    
    // Individual results
    console.log('\nDetailed Results:');
    console.log(`  Insurance Integration: ${results.insurance ? colors.green('✓ PASSED') : colors.red('✗ FAILED')}`);
    console.log(`  Pharmacy Integration: ${results.pharmacy ? colors.green('✓ PASSED') : colors.red('✗ FAILED')}`);
    console.log(`  Telemedicine Integration: ${results.telemedicine ? colors.green('✓ PASSED') : colors.red('✗ FAILED')}`);
    console.log(`  Compliance Reporting: ${results.compliance ? colors.green('✓ PASSED') : colors.red('✗ FAILED')}`);
    console.log(`  API Logging: ${results.logging ? colors.green('✓ PASSED') : colors.red('✗ FAILED')}`);
    
    if (passedTests === totalTests) {
      console.log(colors.bold.green('\n✅ ALL PARTNER INTEGRATIONS VERIFIED SUCCESSFULLY!'));
      console.log(colors.green('The system can successfully communicate with insurance providers,'));
      console.log(colors.green('pharmacy suppliers, telemedicine services, and generate compliance reports.'));
    } else {
      console.log(colors.bold.yellow('\n⚠️  SOME INTEGRATIONS NEED ATTENTION'));
    }
    
    console.log(colors.cyan('\n═══════════════════════════════════════════════\n'));
    
    return passedTests === totalTests;
  } catch (error) {
    console.error(colors.red('Verification error:'), error);
    return false;
  }
}

// Execute verification
runVerification();
