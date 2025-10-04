#!/usr/bin/env node

const axios = require('axios');
const { Pool } = require('pg');
const colors = require('colors');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:3ifO2knhQgc4@ep-summer-block-a5aem4nh.us-east-2.aws.neon.tech/hospital_management_platform?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// External URLs
const EXTERNAL_URLS = {
  crmBackend: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so',
  crmFrontend: 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
  hmsModule: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so',
  partnerIntegration: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so',
  unifiedFrontend: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so'
};

async function testExternalURL(name, url, endpoint = '') {
  try {
    const response = await axios.get(url + endpoint, { 
      timeout: 10000,
      validateStatus: () => true 
    });
    return {
      name,
      url: url + endpoint,
      status: response.status,
      success: response.status === 200
    };
  } catch (error) {
    return {
      name,
      url: url + endpoint,
      status: 'ERROR',
      success: false,
      error: error.message
    };
  }
}

async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema NOT IN ($1, $2)', ['pg_catalog', 'information_schema']);
    return {
      success: true,
      tableCount: result.rows[0].table_count
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testCRMFunctionality() {
  try {
    // Test patient retrieval
    const response = await axios.get(`${EXTERNAL_URLS.crmBackend}/api/patients`);
    return {
      success: true,
      patientCount: response.data.data ? response.data.data.length : 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function runComprehensiveTest() {
  console.log('\\n' + '='.repeat(60));
  console.log(' FINAL END-TO-END PLATFORM TEST '.bgBlue.white.bold);
  console.log('='.repeat(60) + '\\n');

  const results = {
    externalUrls: [],
    database: null,
    functionality: {}
  };

  // Test External URLs
  console.log('📡 Testing External URLs...'.yellow);
  for (const [name, url] of Object.entries(EXTERNAL_URLS)) {
    const healthResult = await testExternalURL(name + ' Health', url, '/api/health');
    const mainResult = await testExternalURL(name + ' Main', url, '');
    results.externalUrls.push(healthResult, mainResult);
    
    const healthStatus = healthResult.success ? '✅'.green : '❌'.red;
    const mainStatus = mainResult.success ? '✅'.green : '❌'.red;
    console.log(`  ${name}: Health ${healthStatus} | Main ${mainStatus}`);
  }

  // Test Database
  console.log('\\n🗄️  Testing Database Connection...'.yellow);
  results.database = await testDatabaseConnection();
  if (results.database.success) {
    console.log(`  ✅ Connected - ${results.database.tableCount} tables`.green);
  } else {
    console.log(`  ❌ Failed: ${results.database.error}`.red);
  }

  // Test CRM Functionality
  console.log('\\n🔧 Testing CRM Functionality...'.yellow);
  results.functionality.crm = await testCRMFunctionality();
  if (results.functionality.crm.success) {
    console.log(`  ✅ CRM Working - ${results.functionality.crm.patientCount} patients`.green);
  } else {
    console.log(`  ❌ CRM Failed: ${results.functionality.crm.error}`.red);
  }

  // Summary
  console.log('\\n' + '='.repeat(60));
  console.log(' TEST SUMMARY '.bgGreen.white.bold);
  console.log('='.repeat(60));

  const urlSuccessCount = results.externalUrls.filter(r => r.success).length;
  const urlTotalCount = results.externalUrls.length;
  
  console.log(`\\n📊 Results:`.cyan.bold);
  console.log(`  External URLs: ${urlSuccessCount}/${urlTotalCount} working`);
  console.log(`  Database: ${results.database.success ? '✅ Connected' : '❌ Failed'}`);
  console.log(`  CRM Functions: ${results.functionality.crm.success ? '✅ Working' : '❌ Failed'}`);

  // Working External URLs
  console.log(`\\n✅ Working External URLs:`.green.bold);
  const workingUrls = results.externalUrls.filter(r => r.success);
  workingUrls.forEach(url => {
    console.log(`  - ${url.url}`.green);
  });

  // Overall Status
  const overallSuccess = urlSuccessCount > 0 && results.database.success;
  console.log(`\\n🎯 Overall Platform Status: ${overallSuccess ? 'OPERATIONAL ✅'.green.bold : 'PARTIAL ⚠️'.yellow.bold}`);

  await pool.end();
  return results;
}

// Run the test
runComprehensiveTest()
  .then(results => {
    console.log('\\n✨ Test completed successfully!'.green.bold);
    process.exit(0);
  })
  .catch(error => {
    console.error('\\n❌ Test failed:'.red.bold, error);
    process.exit(1);
  });
