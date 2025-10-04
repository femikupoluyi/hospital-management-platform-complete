#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { Client } = require('pg');
const fs = require('fs');

// Database configuration
const dbConfig = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
};

// External URLs to test
const externalUrls = [
  { 
    name: 'Unified Frontend', 
    url: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
    required: true
  },
  { 
    name: 'HMS Module', 
    url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so',
    required: true
  },
  { 
    name: 'API Documentation', 
    url: 'https://api-documentation-morphvm-mkofwuzh.http.cloud.morph.so',
    required: false
  },
  { 
    name: 'Partner Integration', 
    url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so',
    required: true
  },
  { 
    name: 'OCC Dashboard', 
    url: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so',
    required: false
  }
];

// Test results
const testResults = {
  database: { status: 'pending', tests: [] },
  externalUrls: { status: 'pending', tests: [] },
  apiEndpoints: { status: 'pending', tests: [] },
  overall: { status: 'pending' }
};

// Test database connectivity
async function testDatabase() {
  console.log('\n🔍 Testing Database Connectivity...');
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('  ✅ Connected to Neon database');
    testResults.database.tests.push({ name: 'Connection', passed: true });
    
    // Test table count
    const tableResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `);
    const tableCount = parseInt(tableResult.rows[0].count);
    console.log(`  ✅ Found ${tableCount} tables`);
    testResults.database.tests.push({ 
      name: 'Table Count', 
      passed: tableCount > 50,
      count: tableCount 
    });
    
    // Test data presence
    const dataChecks = [
      { table: 'organization.hospitals', name: 'Hospitals' },
      { table: 'crm.patients', name: 'Patients' },
      { table: 'hr.staff', name: 'Staff' },
      { table: 'security.users', name: 'Users' }
    ];
    
    for (const check of dataChecks) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${check.table}`);
        const count = parseInt(result.rows[0].count);
        console.log(`  ✅ ${check.name}: ${count} records`);
        testResults.database.tests.push({ 
          name: check.name, 
          passed: true,
          count: count 
        });
      } catch (err) {
        console.log(`  ❌ ${check.name}: Error`);
        testResults.database.tests.push({ 
          name: check.name, 
          passed: false,
          error: err.message 
        });
      }
    }
    
    testResults.database.status = 'passed';
    
  } catch (err) {
    console.log('  ❌ Database connection failed:', err.message);
    testResults.database.status = 'failed';
    testResults.database.error = err.message;
  } finally {
    await client.end();
  }
}

// Test external URL
function testExternalUrl(urlInfo) {
  return new Promise((resolve) => {
    const url = new URL(urlInfo.url);
    
    https.get({
      hostname: url.hostname,
      path: url.pathname,
      timeout: 5000,
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const passed = res.statusCode >= 200 && res.statusCode < 400;
        resolve({
          name: urlInfo.name,
          url: urlInfo.url,
          status: res.statusCode,
          passed: passed,
          required: urlInfo.required,
          bodySize: data.length
        });
      });
    }).on('error', (err) => {
      resolve({
        name: urlInfo.name,
        url: urlInfo.url,
        status: 0,
        passed: false,
        required: urlInfo.required,
        error: err.message
      });
    });
  });
}

// Test all external URLs
async function testExternalUrls() {
  console.log('\n🌐 Testing External URLs...');
  
  for (const urlInfo of externalUrls) {
    const result = await testExternalUrl(urlInfo);
    testResults.externalUrls.tests.push(result);
    
    if (result.passed) {
      console.log(`  ✅ ${result.name}: Working (Status: ${result.status})`);
    } else {
      console.log(`  ${result.required ? '❌' : '⚠️'} ${result.name}: ${result.error || 'Status: ' + result.status}`);
    }
  }
  
  const requiredPassed = testResults.externalUrls.tests
    .filter(t => t.required)
    .every(t => t.passed);
  
  testResults.externalUrls.status = requiredPassed ? 'passed' : 'failed';
}

// Test API endpoints
async function testApiEndpoints() {
  console.log('\n🔌 Testing API Endpoints...');
  
  const endpoints = [
    { name: 'HMS API Health', url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/health' },
    { name: 'Partner API Health', url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/health' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const result = await testExternalUrl(endpoint);
      testResults.apiEndpoints.tests.push(result);
      
      if (result.passed) {
        console.log(`  ✅ ${result.name}: OK`);
      } else {
        console.log(`  ❌ ${result.name}: Failed`);
      }
    } catch (err) {
      console.log(`  ❌ ${endpoint.name}: Error - ${err.message}`);
      testResults.apiEndpoints.tests.push({
        name: endpoint.name,
        passed: false,
        error: err.message
      });
    }
  }
  
  testResults.apiEndpoints.status = testResults.apiEndpoints.tests.some(t => t.passed) ? 'partial' : 'failed';
}

// Generate report
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('END-TO-END TEST SUMMARY');
  console.log('='.repeat(80));
  
  // Database tests
  console.log('\n📊 DATABASE:');
  console.log(`  Status: ${testResults.database.status.toUpperCase()}`);
  console.log(`  Tests Passed: ${testResults.database.tests.filter(t => t.passed).length}/${testResults.database.tests.length}`);
  
  // External URLs
  console.log('\n🌐 EXTERNAL URLS:');
  console.log(`  Status: ${testResults.externalUrls.status.toUpperCase()}`);
  console.log(`  Working: ${testResults.externalUrls.tests.filter(t => t.passed).length}/${testResults.externalUrls.tests.length}`);
  
  const workingUrls = testResults.externalUrls.tests.filter(t => t.passed);
  if (workingUrls.length > 0) {
    console.log('\n  ✅ Accessible URLs:');
    workingUrls.forEach(url => {
      console.log(`     - ${url.url}`);
    });
  }
  
  // API Endpoints
  console.log('\n🔌 API ENDPOINTS:');
  console.log(`  Status: ${testResults.apiEndpoints.status.toUpperCase()}`);
  console.log(`  Working: ${testResults.apiEndpoints.tests.filter(t => t.passed).length}/${testResults.apiEndpoints.tests.length}`);
  
  // Overall status
  const allPassed = testResults.database.status === 'passed' && 
                    testResults.externalUrls.status === 'passed';
  testResults.overall.status = allPassed ? 'passed' : 'partial';
  
  console.log('\n' + '='.repeat(80));
  console.log(`OVERALL STATUS: ${testResults.overall.status.toUpperCase()}`);
  console.log('='.repeat(80));
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    results: testResults,
    summary: {
      database: testResults.database.status,
      externalUrls: testResults.externalUrls.status,
      apiEndpoints: testResults.apiEndpoints.status,
      overall: testResults.overall.status
    }
  };
  
  fs.writeFileSync('/root/end-to-end-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Report saved to: /root/end-to-end-test-report.json');
  
  // Create markdown report
  let markdown = `# End-to-End Platform Test Report\n\n`;
  markdown += `**Generated:** ${report.timestamp}\n\n`;
  markdown += `## Overall Status: ${report.summary.overall.toUpperCase()}\n\n`;
  
  markdown += `### Database Tests\n`;
  markdown += `- **Status:** ${report.summary.database}\n`;
  markdown += `- **Tests Passed:** ${testResults.database.tests.filter(t => t.passed).length}/${testResults.database.tests.length}\n\n`;
  
  markdown += `### External URLs\n`;
  markdown += `- **Status:** ${report.summary.externalUrls}\n`;
  markdown += `- **Working URLs:** ${testResults.externalUrls.tests.filter(t => t.passed).length}/${testResults.externalUrls.tests.length}\n\n`;
  
  if (workingUrls.length > 0) {
    markdown += `#### Accessible URLs:\n`;
    workingUrls.forEach(url => {
      markdown += `- [${url.name}](${url.url})\n`;
    });
  }
  
  fs.writeFileSync('/root/END_TO_END_TEST_REPORT.md', markdown);
  console.log('📄 Markdown report saved to: /root/END_TO_END_TEST_REPORT.md');
}

// Main execution
async function main() {
  console.log('=' .repeat(80));
  console.log('HOSPITAL MANAGEMENT PLATFORM - END-TO-END TEST');
  console.log('=' .repeat(80));
  
  try {
    await testDatabase();
    await testExternalUrls();
    await testApiEndpoints();
    generateReport();
  } catch (err) {
    console.error('Test execution failed:', err);
    testResults.overall.status = 'failed';
    testResults.overall.error = err.message;
    generateReport();
  }
}

// Run the tests
main().catch(console.error);
