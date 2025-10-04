#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

// List of all services and their ports with correct URL pattern
const services = [
  { name: 'Main Frontend (Next.js)', port: 3000, path: '/', pm2: 'hospital-app', external: 'https://hospital-app-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Hospital Backend', port: 5000, path: '/api/health', pm2: 'hospital-backend', external: 'https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Main Frontend Server', port: 3001, path: '/', pm2: 'main-frontend', external: 'https://main-frontend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Unified Frontend', port: 3002, path: '/', pm2: 'unified-frontend', external: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'CRM Backend', port: 7000, path: '/api/health', pm2: 'crm-backend', external: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'CRM Frontend', port: 7001, path: '/', pm2: 'crm-frontend', external: 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'API Documentation', port: 8080, path: '/', pm2: 'api-docs', external: 'https://api-docs-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'HMS Module', port: 9000, path: '/api/health', pm2: 'hms-module', external: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'OCC Dashboard', port: 10001, path: '/', pm2: 'occ-enhanced', external: 'https://occ-enhanced-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Partner Integration', port: 11000, path: '/api/health', pm2: 'partner-integration', external: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Analytics ML', port: 13000, path: '/api/health', pm2: 'analytics-ml', external: 'https://analytics-ml-morphvm-mkofwuzh.http.cloud.morph.so' }
];

async function testService(service) {
  const results = { 
    name: service.name, 
    localUrl: `http://localhost:${service.port}${service.path}`,
    externalUrl: service.external,
    localStatus: 'Failed',
    externalStatus: 'Failed'
  };
  
  // Test local
  try {
    const response = await axios.get(results.localUrl, { timeout: 5000 });
    results.localStatus = `OK (${response.status})`;
  } catch (error) {
    results.localStatus = error.code || 'Error';
  }
  
  // Test external
  try {
    const response = await axios.get(results.externalUrl, { 
      timeout: 10000,
      validateStatus: () => true // Accept any status code
    });
    results.externalStatus = `${response.status}`;
  } catch (error) {
    results.externalStatus = error.code || 'Error';
  }
  
  return results;
}

async function testAllServices() {
  console.log('\\n=== Testing All Hospital Management Platform Services ===\\n');
  
  const results = [];
  for (const service of services) {
    const result = await testService(service);
    results.push(result);
    
    const localColor = result.localStatus.includes('OK') ? 'green' : 'red';
    const externalColor = result.externalStatus === '200' ? 'green' : 
                         result.externalStatus === '404' ? 'yellow' : 'red';
    
    console.log(`${result.name}:`);
    console.log(`  Local: ${result.localUrl} - ${result.localStatus}`[localColor]);
    console.log(`  External: ${result.externalUrl} - ${result.externalStatus}`[externalColor]);
    console.log('');
  }
  
  // Summary
  console.log('\\n=== Summary ===\\n');
  const workingLocal = results.filter(r => r.localStatus.includes('OK')).length;
  const workingExternal = results.filter(r => r.externalStatus === '200').length;
  
  console.log(`Local Services Working: ${workingLocal}/${services.length}`);
  console.log(`External URLs Working: ${workingExternal}/${services.length}`);
  console.log('\\nNOTE: External URLs need to be exposed via the expose_port tool');
  
  return results;
}

// Run if executed directly
if (require.main === module) {
  testAllServices().catch(console.error);
}

module.exports = { testAllServices };
