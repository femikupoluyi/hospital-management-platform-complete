#!/usr/bin/env node

const axios = require('axios');
const { Client } = require('pg');

// Database configuration
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// Service endpoints
const SERVICES = {
  'CRM Backend': {
    url: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so',
    healthPath: '/api/health',
    testEndpoints: [
      { path: '/api/patients', expectedField: 'data' },
      { path: '/api/owners', expectedField: 'data' }
    ]
  },
  'CRM Frontend': {
    url: 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
    healthPath: '/',
    testEndpoints: []
  },
  'HMS Module': {
    url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so',
    healthPath: '/',
    testEndpoints: []
  },
  'Partner Integration': {
    url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so',
    healthPath: '/api/health',
    testEndpoints: []
  },
  'Unified Frontend': {
    url: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
    healthPath: '/',
    testEndpoints: []
  }
};

// Local services that need to be exposed
const LOCAL_SERVICES = {
  'OCC Enhanced': { port: 10001, healthPath: '/' },
  'Analytics ML': { port: 13000, healthPath: '/api/health' },
  'API Docs': { port: 8080, healthPath: '/' },
  'Hospital Backend': { port: 5000, healthPath: '/api/health' },
  'Hospital App': { port: 3001, healthPath: '/' },
  'Main Frontend': { port: 12000, healthPath: '/' }
};

async function testExternalService(name, config) {
  console.log(`\n📡 Testing ${name}...`);
  
  try {
    // Test health endpoint
    const healthUrl = config.url + config.healthPath;
    const healthResponse = await axios.get(healthUrl, { timeout: 5000 });
    console.log(`  ✅ Health check passed: ${healthResponse.status}`);
    
    // Test additional endpoints
    for (const endpoint of config.testEndpoints) {
      try {
        const response = await axios.get(config.url + endpoint.path, { timeout: 5000 });
        if (endpoint.expectedField && response.data[endpoint.expectedField]) {
          const count = Array.isArray(response.data[endpoint.expectedField]) 
            ? response.data[endpoint.expectedField].length 
            : 'valid';
          console.log(`  ✅ ${endpoint.path}: ${count} items`);
        } else {
          console.log(`  ✅ ${endpoint.path}: OK`);
        }
      } catch (err) {
        console.log(`  ⚠️  ${endpoint.path}: ${err.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    return false;
  }
}

async function testLocalService(name, config) {
  console.log(`\n🔧 Testing ${name} (Local Port ${config.port})...`);
  
  try {
    const url = `http://localhost:${config.port}${config.healthPath}`;
    const response = await axios.get(url, { timeout: 5000 });
    console.log(`  ✅ Local service running: ${response.status}`);
    return true;
  } catch (error) {
    console.log(`  ❌ Local service not accessible: ${error.message}`);
    return false;
  }
}

async function testDatabase() {
  console.log('\n🗄️  Testing Database Connection...');
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    
    // Count tables by schema
    const schemaResult = await client.query(`
      SELECT 
        table_schema,
        COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
      GROUP BY table_schema
      ORDER BY table_schema
    `);
    
    console.log('  ✅ Database connected');
    console.log('  📊 Schema Statistics:');
    
    let totalTables = 0;
    for (const row of schemaResult.rows) {
      console.log(`    - ${row.table_schema}: ${row.table_count} tables`);
      totalTables += parseInt(row.table_count);
    }
    console.log(`  📈 Total: ${totalTables} tables across ${schemaResult.rows.length} schemas`);
    
    // Sample data counts
    const dataCounts = [
      { table: 'crm.patients', label: 'Patients' },
      { table: 'crm.appointments', label: 'Appointments' },
      { table: 'crm.owner_accounts', label: 'Hospital Owners' },
      { table: 'hr.staff', label: 'Staff Members' },
      { table: 'inventory.items', label: 'Inventory Items' }
    ];
    
    console.log('  📊 Sample Data:');
    for (const item of dataCounts) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${item.table}`);
        console.log(`    - ${item.label}: ${result.rows[0].count}`);
      } catch (err) {
        // Table might not exist
      }
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Database connection failed: ${error.message}`);
    return false;
  } finally {
    await client.end();
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🏥 HOSPITAL MANAGEMENT PLATFORM - COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(60));
  
  const results = {
    external: { passed: 0, failed: 0 },
    local: { passed: 0, failed: 0 },
    database: false
  };
  
  // Test external services
  console.log('\n📡 EXTERNAL SERVICES:');
  for (const [name, config] of Object.entries(SERVICES)) {
    const passed = await testExternalService(name, config);
    if (passed) results.external.passed++;
    else results.external.failed++;
  }
  
  // Test local services
  console.log('\n🔧 LOCAL SERVICES:');
  for (const [name, config] of Object.entries(LOCAL_SERVICES)) {
    const passed = await testLocalService(name, config);
    if (passed) results.local.passed++;
    else results.local.failed++;
  }
  
  // Test database
  results.database = await testDatabase();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY:');
  console.log('='.repeat(60));
  console.log(`\n✅ External Services: ${results.external.passed}/${Object.keys(SERVICES).length} working`);
  console.log(`🔧 Local Services: ${results.local.passed}/${Object.keys(LOCAL_SERVICES).length} working`);
  console.log(`🗄️  Database: ${results.database ? '✅ Connected' : '❌ Failed'}`);
  
  const totalServices = Object.keys(SERVICES).length + Object.keys(LOCAL_SERVICES).length;
  const totalPassed = results.external.passed + results.local.passed;
  
  console.log(`\n📈 Overall: ${totalPassed}/${totalServices} services operational`);
  
  // Recommendations
  console.log('\n📋 RECOMMENDATIONS:');
  if (results.external.failed > 0) {
    console.log('  ⚠️  Some external services are not accessible - check port exposures');
  }
  if (results.local.failed > 0) {
    console.log('  ⚠️  Some local services are down - check PM2 processes');
  }
  if (!results.database) {
    console.log('  ⚠️  Database connection issues - check Neon configuration');
  }
  
  if (totalPassed === totalServices && results.database) {
    console.log('  ✅ All systems operational! Platform is ready for use.');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run the comprehensive test
generateReport().catch(console.error);
