#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');
const { Client } = require('pg');

// Database configuration
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// Service configurations
const SERVICES = {
  'Unified Frontend': {
    url: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so/',
    type: 'frontend'
  },
  'CRM Backend': {
    url: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
    type: 'api'
  },
  'CRM Frontend': {
    url: 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so/',
    type: 'frontend'
  },
  'HMS Module': {
    url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
    type: 'api'
  },
  'OCC Command Centre': {
    url: 'https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/',
    type: 'frontend'
  },
  'Partner Integration': {
    url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
    type: 'api'
  }
};

// API endpoints to test
const API_TESTS = [
  {
    name: 'CRM - Owners',
    url: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/owners',
    expectedStatus: 200
  },
  {
    name: 'CRM - Patients',
    url: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/patients',
    expectedStatus: 200
  },
  {
    name: 'HMS - Patients',
    url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/hms/patients',
    expectedStatus: 200
  },
  {
    name: 'HMS - Inventory',
    url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/hms/inventory',
    expectedStatus: 200
  },
  {
    name: 'OCC - Dashboard',
    url: 'https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/api/occ/dashboard',
    expectedStatus: 200
  },
  {
    name: 'Partners - Insurance',
    url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/partners/insurance',
    expectedStatus: 200
  },
  {
    name: 'Partners - Pharmacy',
    url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/partners/pharmacy',
    expectedStatus: 200
  }
];

// Test service availability
async function testService(name, config) {
  try {
    const response = await axios.get(config.url, {
      timeout: 5000,
      validateStatus: (status) => status < 500
    });
    
    if (response.status === 200 || response.status === 304) {
      console.log(`  ✅ ${name.padEnd(25)} - ${colors.green('ONLINE')} (${response.status})`);
      return true;
    } else {
      console.log(`  ⚠️  ${name.padEnd(25)} - ${colors.yellow('WARNING')} (${response.status})`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ${name.padEnd(25)} - ${colors.red('OFFLINE')} (${error.message})`);
    return false;
  }
}

// Test API endpoint
async function testAPI(test) {
  try {
    const response = await axios.get(test.url, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    const passed = response.status === test.expectedStatus;
    const dataCount = Array.isArray(response.data) ? response.data.length : 'N/A';
    
    if (passed) {
      console.log(`  ✅ ${test.name.padEnd(25)} - ${colors.green('PASS')} (Status: ${response.status}, Records: ${dataCount})`);
    } else {
      console.log(`  ❌ ${test.name.padEnd(25)} - ${colors.red('FAIL')} (Expected: ${test.expectedStatus}, Got: ${response.status})`);
    }
    
    return passed;
  } catch (error) {
    console.log(`  ❌ ${test.name.padEnd(25)} - ${colors.red('ERROR')} (${error.message})`);
    return false;
  }
}

// Test database connectivity
async function testDatabase() {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    // Count schemas
    const schemaResult = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')
    `);
    
    // Count tables
    const tableResult = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    `);
    
    // Sample data counts
    const patientCount = await client.query('SELECT COUNT(*) as count FROM crm.patients');
    const hospitalCount = await client.query('SELECT COUNT(*) as count FROM organization.hospitals');
    const staffCount = await client.query('SELECT COUNT(*) as count FROM hr.staff');
    
    console.log(`  ✅ Database Connection: ${colors.green('CONNECTED')}`);
    console.log(`     • Schemas: ${schemaResult.rows[0].count}`);
    console.log(`     • Tables: ${tableResult.rows[0].count}`);
    console.log(`     • Patients: ${patientCount.rows[0].count}`);
    console.log(`     • Hospitals: ${hospitalCount.rows[0].count}`);
    console.log(`     • Staff: ${staffCount.rows[0].count}`);
    
    return true;
  } catch (error) {
    console.log(`  ❌ Database Connection: ${colors.red('FAILED')}`);
    console.log(`     Error: ${error.message}`);
    return false;
  } finally {
    await client.end();
  }
}

// Main test runner
async function runComprehensiveTest() {
  console.log(colors.bold.cyan('\n╔════════════════════════════════════════╗'));
  console.log(colors.bold.cyan('║   HOSPITAL MANAGEMENT PLATFORM TEST   ║'));
  console.log(colors.bold.cyan('╚════════════════════════════════════════╝\n'));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  // Test Services
  console.log(colors.cyan('▶ SERVICE HEALTH CHECK'));
  console.log('─'.repeat(45));
  for (const [name, config] of Object.entries(SERVICES)) {
    const passed = await testService(name, config);
    if (passed) totalPassed++; else totalFailed++;
  }
  
  // Test Database
  console.log(colors.cyan('\n▶ DATABASE CONNECTIVITY'));
  console.log('─'.repeat(45));
  const dbPassed = await testDatabase();
  if (dbPassed) totalPassed++; else totalFailed++;
  
  // Test API Endpoints
  console.log(colors.cyan('\n▶ API ENDPOINT TESTS'));
  console.log('─'.repeat(45));
  for (const test of API_TESTS) {
    const passed = await testAPI(test);
    if (passed) totalPassed++; else totalFailed++;
  }
  
  // Summary
  console.log(colors.cyan('\n▶ TEST SUMMARY'));
  console.log('─'.repeat(45));
  const totalTests = totalPassed + totalFailed;
  const passRate = ((totalPassed / totalTests) * 100).toFixed(1);
  
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${colors.green(totalPassed)}`);
  console.log(`  Failed: ${colors.red(totalFailed)}`);
  console.log(`  Pass Rate: ${passRate >= 80 ? colors.green(passRate + '%') : passRate >= 50 ? colors.yellow(passRate + '%') : colors.red(passRate + '%')}`);
  
  // System Status
  console.log(colors.cyan('\n▶ SYSTEM STATUS'));
  console.log('─'.repeat(45));
  if (passRate >= 90) {
    console.log(`  ${colors.bold.green('✅ FULLY OPERATIONAL')}`);
    console.log(`  All critical systems are functioning properly.`);
  } else if (passRate >= 70) {
    console.log(`  ${colors.bold.yellow('⚠️  PARTIALLY OPERATIONAL')}`);
    console.log(`  Some services need attention.`);
  } else {
    console.log(`  ${colors.bold.red('❌ CRITICAL ISSUES DETECTED')}`);
    console.log(`  Immediate intervention required.`);
  }
  
  // External Access URLs
  console.log(colors.cyan('\n▶ EXTERNAL ACCESS URLS'));
  console.log('─'.repeat(45));
  console.log(`  1. Main Platform:`);
  console.log(`     ${colors.blue('https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so/')}`);
  console.log(`  2. CRM System:`);
  console.log(`     ${colors.blue('https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so/')}`);
  console.log(`  3. OCC Dashboard:`);
  console.log(`     ${colors.blue('https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/')}`);
  console.log(`  4. Business Website:`);
  console.log(`     ${colors.blue('https://preview--healthflow-alliance.lovable.app/')}`);
  
  console.log(colors.cyan('\n' + '═'.repeat(45) + '\n'));
  
  return { totalPassed, totalFailed, passRate };
}

// Run the test
runComprehensiveTest()
  .then((results) => {
    if (results.passRate >= 90) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
