#!/usr/bin/env node

const http = require('http');
const https = require('https');
const fs = require('fs');

console.log('════════════════════════════════════════════════════════════════════════');
console.log('     GRANDPRO HMSO - HOSPITAL MANAGEMENT PLATFORM');
console.log('     COMPREHENSIVE END-TO-END VERIFICATION');
console.log('════════════════════════════════════════════════════════════════════════\n');

// Configuration
const MODULES = {
  'Unified Frontend': {
    internal: 'http://localhost:12000',
    external: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/']
  },
  'Hospital Onboarding': {
    internal: 'http://localhost:3000',
    external: 'https://hospital-onboarding-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/api/health', '/api/applications', '/api/dashboard']
  },
  'HMS Module': {
    internal: 'http://localhost:3002',
    external: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/']
  },
  'API Documentation': {
    internal: 'http://localhost:5000',
    external: 'https://api-documentation-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/']
  },
  'OCC Dashboard': {
    internal: 'http://localhost:8080',
    external: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/']
  },
  'Partner Integration': {
    internal: 'http://localhost:9000',
    external: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/']
  },
  'Analytics ML': {
    internal: 'http://localhost:11000',
    external: 'https://analytics-ml-morphvm-mkofwuzh.http.cloud.morph.so',
    endpoints: ['/api/analytics/metrics']
  }
};

const DATABASE = {
  host: 'ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech',
  database: 'neondb',
  project: 'snowy-bird-64526166'
};

// Helper function to make HTTP requests
async function makeRequest(url, timeout = 5000) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const timer = setTimeout(() => {
      resolve({ status: 'TIMEOUT', error: 'Request timeout' });
    }, timeout);
    
    const req = client.get(url, (res) => {
      clearTimeout(timer);
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 100) // First 100 chars
        });
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'ERROR', error: error.message });
    });
    
    req.end();
  });
}

// Test Results Storage
const results = {
  timestamp: new Date().toISOString(),
  modules: {},
  database: {},
  summary: {
    total_modules: 0,
    working_internally: 0,
    working_externally: 0,
    fully_operational: 0
  }
};

// Test each module
async function testModule(name, config) {
  console.log(`\n📦 Testing: ${name}`);
  console.log('━'.repeat(60));
  
  const moduleResult = {
    internal: { accessible: false, endpoints: {} },
    external: { accessible: false, url: config.external }
  };
  
  // Test internal endpoints
  console.log('  Internal Tests:');
  for (const endpoint of config.endpoints) {
    const url = config.internal + endpoint;
    const response = await makeRequest(url);
    const success = response.status >= 200 && response.status < 400;
    moduleResult.internal.endpoints[endpoint] = {
      status: response.status,
      success
    };
    console.log(`    ${success ? '✅' : '❌'} ${endpoint}: ${response.status || response.error}`);
    if (success) moduleResult.internal.accessible = true;
  }
  
  // Test external access
  console.log('  External Access:');
  const externalResponse = await makeRequest(config.external);
  const externalSuccess = externalResponse.status >= 200 && externalResponse.status < 400;
  moduleResult.external.accessible = externalSuccess;
  moduleResult.external.status = externalResponse.status;
  
  console.log(`    ${externalSuccess ? '✅' : '❌'} ${config.external.replace('https://', '').replace('-morphvm-mkofwuzh.http.cloud.morph.so', '')}: ${externalResponse.status || externalResponse.error}`);
  
  // Update summary
  results.summary.total_modules++;
  if (moduleResult.internal.accessible) results.summary.working_internally++;
  if (moduleResult.external.accessible) results.summary.working_externally++;
  if (moduleResult.internal.accessible && moduleResult.external.accessible) {
    results.summary.fully_operational++;
  }
  
  results.modules[name] = moduleResult;
  return moduleResult;
}

// Test database connectivity
async function testDatabase() {
  console.log('\n🗄️  Testing: Database Connection');
  console.log('━'.repeat(60));
  
  const { Client } = require('pg');
  const connectionString = `postgresql://neondb_owner:npg_lIeD35dukpfC@${DATABASE.host}/${DATABASE.database}?sslmode=require`;
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('  ✅ Connected to Neon PostgreSQL');
    
    // Count tables
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count, 
             COUNT(DISTINCT table_schema) as schema_count 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `);
    
    const { table_count, schema_count } = tablesResult.rows[0];
    console.log(`  ✅ Database has ${table_count} tables across ${schema_count} schemas`);
    
    // Check key schemas
    const schemasResult = await client.query(`
      SELECT DISTINCT table_schema 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema
    `);
    
    console.log('  ✅ Available schemas:');
    schemasResult.rows.forEach(row => {
      console.log(`     • ${row.table_schema}`);
    });
    
    results.database = {
      connected: true,
      host: DATABASE.host,
      database: DATABASE.database,
      project: DATABASE.project,
      table_count: parseInt(table_count),
      schema_count: parseInt(schema_count),
      schemas: schemasResult.rows.map(r => r.table_schema)
    };
    
    await client.end();
    
  } catch (error) {
    console.log(`  ❌ Database connection failed: ${error.message}`);
    results.database = {
      connected: false,
      error: error.message
    };
  }
}

// Test PM2 processes
async function testProcesses() {
  console.log('\n⚙️  Testing: Running Processes');
  console.log('━'.repeat(60));
  
  return new Promise((resolve) => {
    const exec = require('child_process').exec;
    exec('pm2 jlist', (error, stdout, stderr) => {
      if (error) {
        console.log(`  ❌ PM2 check failed: ${error.message}`);
        resolve();
        return;
      }
      
      try {
        const processes = JSON.parse(stdout);
        console.log(`  ✅ ${processes.length} processes running under PM2`);
        
        processes.forEach(proc => {
          const status = proc.pm2_env.status === 'online' ? '✅' : '❌';
          console.log(`     ${status} ${proc.name}: ${proc.pm2_env.status}`);
        });
        
        results.processes = processes.map(p => ({
          name: p.name,
          status: p.pm2_env.status,
          restarts: p.pm2_env.restart_time,
          memory: Math.round(p.monit.memory / 1024 / 1024) + 'MB'
        }));
        
      } catch (e) {
        console.log(`  ⚠️ Could not parse PM2 output`);
      }
      
      resolve();
    });
  });
}

// Generate report
function generateReport() {
  console.log('\n');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('                          VERIFICATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════════════════');
  
  const { summary } = results;
  
  console.log('\n📊 Module Status:');
  console.log(`   Total Modules: ${summary.total_modules}`);
  console.log(`   Working Internally: ${summary.working_internally}/${summary.total_modules}`);
  console.log(`   Working Externally: ${summary.working_externally}/${summary.total_modules}`);
  console.log(`   Fully Operational: ${summary.fully_operational}/${summary.total_modules}`);
  
  console.log('\n🗄️ Database Status:');
  if (results.database.connected) {
    console.log(`   ✅ Connected to Neon PostgreSQL`);
    console.log(`   Tables: ${results.database.table_count}`);
    console.log(`   Schemas: ${results.database.schema_count}`);
  } else {
    console.log(`   ❌ Database connection failed`);
  }
  
  console.log('\n🌐 External URLs Status:');
  Object.entries(results.modules).forEach(([name, module]) => {
    const status = module.external.accessible ? '✅ ONLINE' : '❌ OFFLINE';
    console.log(`   ${status}: ${name}`);
  });
  
  // Overall health
  const healthScore = Math.round(
    (summary.fully_operational / summary.total_modules) * 100
  );
  
  console.log('\n🏥 Platform Health Score: ' + healthScore + '%');
  
  if (healthScore === 100) {
    console.log('   🎉 All systems fully operational!');
  } else if (healthScore >= 70) {
    console.log('   ⚠️ Platform partially operational, some issues detected');
  } else {
    console.log('   ❌ Platform has critical issues requiring attention');
  }
  
  // Save results
  fs.writeFileSync(
    '/root/platform-verification-results.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n📄 Detailed results saved to: /root/platform-verification-results.json');
  console.log('════════════════════════════════════════════════════════════════════════\n');
}

// Main execution
async function main() {
  console.log('Starting comprehensive platform verification...');
  console.log('Time: ' + new Date().toLocaleString());
  
  // Test all modules
  for (const [name, config] of Object.entries(MODULES)) {
    await testModule(name, config);
  }
  
  // Test database
  await testDatabase();
  
  // Test processes
  await testProcesses();
  
  // Generate report
  generateReport();
}

// Run the tests
main().catch(console.error);
